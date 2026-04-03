const { query } = require("../db/client");
const logger    = require("../utils/logger");

/** 数组 -> pgvector 字符串格式： [0.1,0.2,...] */
const toVecStr = (arr) => `[${arr.map(Number).join(",")}]`;

/** cosine 距离 -> 相似度 转换 */
const distToSim = (d) => {
  const n = Number(d);
  if (!Number.isFinite(n)) return 0;
  return 1 - n;
};

async function getVectorDimension() {
  const { rows } = await query(
    `SELECT atttypmod AS dim
     FROM pg_attribute
     WHERE attrelid = 'vectors'::regclass
       AND attname = 'embedding'`
  );
  const dim = Number(rows?.[0]?.dim || 0);
  return Number.isFinite(dim) && dim > 0 ? dim : 0;
}

/**
 * 批量写入向量
 * @param {{ docIds: number[], workspaceId: number, embeddings: number[][] }} params
 */
async function addVectors({ docIds, workspaceId, embeddings }) {
  if (docIds.length !== embeddings.length) {
    throw new Error("docIds 和 embeddings 数量不匹配");
  }
  if (!embeddings.length) return;

  const gotDim = Array.isArray(embeddings[0]) ? embeddings[0].length : 0;
  const expectedDim = await getVectorDimension();
  if (!gotDim || !expectedDim) {
    throw new Error("向量维度检查失败，请确认 vectors.embedding 字段配置");
  }
  if (gotDim !== expectedDim) {
    throw new Error(`向量维度不匹配：数据库要求 ${expectedDim} 维，当前模型返回 ${gotDim} 维。请将 Embedding 向量维度改为 ${expectedDim}，或重建向量表后重传文档。`);
  }
  const invalid = embeddings.findIndex((v) => !Array.isArray(v) || v.length !== expectedDim);
  if (invalid !== -1) {
    throw new Error(`第 ${invalid + 1} 条向量维度异常，期望 ${expectedDim} 维`);
  }

  const values = docIds
    .map((id, i) => `(${id}, ${workspaceId}, '${toVecStr(embeddings[i])}'::vector)`)
    .join(",");

  await query(
    `INSERT INTO vectors (doc_id, workspace_id, embedding) VALUES ${values}`
  );
  logger.debug(`写入 ${docIds.length} 条向量`);
}

/**
 * 余弦相似度检索
 * @returns {{ docId, content, filename, score }[]}
 */
async function similaritySearch({ workspaceId, queryEmbedding, topN = 4, threshold = 0.25 }) {
  const queryDim = Array.isArray(queryEmbedding) ? queryEmbedding.length : 0;
  const expectedDim = await getVectorDimension();
  if (!queryDim || !expectedDim) {
    throw new Error("检索向量维度检查失败，请确认 Embedding 服务和向量表配置");
  }
  if (queryDim !== expectedDim) {
    throw new Error(`检索向量维度不匹配：数据库要求 ${expectedDim} 维，当前模型返回 ${queryDim} 维。请将 Embedding 向量维度改为 ${queryDim} 并重建向量表，随后重新上传文档。`);
  }

  const vecStr = toVecStr(queryEmbedding);
  const fetchLimit = Math.max((Number(topN) || 4) * 6, 20);
  const { rows } = await query(
    `SELECT v.doc_id, v.embedding <=> $1::vector AS _distance,
            d.content, d.filename, d.metadata
     FROM vectors v
     JOIN documents d ON d.id = v.doc_id
     WHERE v.workspace_id = $2
     ORDER BY _distance ASC
     LIMIT $3`,
    [vecStr, workspaceId, fetchLimit]
  );

  const effectiveThreshold = Number.isFinite(Number(threshold)) ? Number(threshold) : 0.25;
  const filtered = rows.filter((r) => {
    if (effectiveThreshold < 0) return true;
    return distToSim(r._distance) >= effectiveThreshold;
  });
  const unique = [];
  const seenFilename = new Set();
  for (const r of filtered) {
    if (seenFilename.has(r.filename)) continue;
    seenFilename.add(r.filename);
    unique.push({
      docId:    r.doc_id,
      content:  r.content,
      filename: r.filename,
      metadata: r.metadata,
      score:    distToSim(r._distance),
    });
    if (unique.length >= topN) break;
  }
  return unique;
}

/** 删除知识库下所有向量 */
async function deleteByWorkspaceId(workspaceId) {
  await query("DELETE FROM vectors WHERE workspace_id = $1", [workspaceId]);
}

/** 删除指定 docIds 的向量 */
async function deleteByDocIds(docIds) {
  if (!docIds.length) return;
  await query(
    `DELETE FROM vectors WHERE doc_id = ANY($1::int[])`,
    [docIds]
  );
}

module.exports = { addVectors, similaritySearch, deleteByWorkspaceId, deleteByDocIds };
