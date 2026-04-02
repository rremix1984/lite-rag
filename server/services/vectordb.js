const { query } = require("../db/client");
const logger    = require("../utils/logger");

/** 数组 -> pgvector 字符串格式： [0.1,0.2,...] */
const toVecStr = (arr) => `[${arr.map(Number).join(",")}]`;

/** cosine 距离 -> 相似度 转换 */
const distToSim = (d) => {
  if (d === null || typeof d !== "number") return 0;
  if (d >= 1) return 1;
  if (d < 0)  return 1 - Math.abs(d);
  return 1 - d;
};

/**
 * 批量写入向量
 * @param {{ docIds: number[], workspaceId: number, embeddings: number[][] }} params
 */
async function addVectors({ docIds, workspaceId, embeddings }) {
  if (docIds.length !== embeddings.length) {
    throw new Error("docIds 和 embeddings 数量不匹配");
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
  const vecStr = toVecStr(queryEmbedding);
  const { rows } = await query(
    `SELECT v.doc_id, v.embedding <=> $1::vector AS _distance,
            d.content, d.filename, d.metadata
     FROM vectors v
     JOIN documents d ON d.id = v.doc_id
     WHERE v.workspace_id = $2
     ORDER BY _distance ASC
     LIMIT $3`,
    [vecStr, workspaceId, topN]
  );

  return rows
    .filter((r) => distToSim(r._distance) >= threshold)
    .map((r) => ({
      docId:    r.doc_id,
      content:  r.content,
      filename: r.filename,
      metadata: r.metadata,
      score:    distToSim(r._distance),
    }));
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
