import express from "express";
import db from "../utils/connect-mysql.js";

const router = express.Router();

// 從資料庫獲取會員資料
router.post("/", async (req, res) => {
  let sid = req.body.sid || 1;
  const [rows, fields] = await db.query(
    `SELECT * FROM profile WHERE sid=${sid}`
  );
  if (rows.length) return res.json(rows[0]);
  else return res.json({});
});


export default router;