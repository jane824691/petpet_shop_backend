import express from "express";
import db from "../utils/connect-mysql.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// 從資料庫獲取會員資料
// router.post("/", async (req, res) => {
//   let sid = req.body.sid || 1;
//   const [rows, fields] = await db.query(
//     `SELECT * FROM profile WHERE sid=${sid}`
//   );
//   if (rows.length) return res.json(rows[0]);
//   else return res.json({});
// });

router.post("/", async (req, res) => {
  const token = req.body.token;  // 從前端請求中取得 token
  
  if (!token) {
    return res.status(401).json({ success: false, error: "沒有授權，不能取得資料" });
  }

  try {
    // 驗證並解碼 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 將解碼的資訊存入 res.locals，供後續使用
    res.locals.jwt = decoded;

    // 驗證 token 是否包含 sid
    if (res.locals.jwt?.sid) {
      let sid = res.locals.jwt.sid;  // 使用解碼後的 sid

      const [rows] = await db.query(`SELECT * FROM profile WHERE sid = ?`, [sid]);

      if (rows.length) {
        // 如果找到會員資料，返回資料
        return res.json(rows[0]);
      } else {
        return res.status(404).json({ message: "找不到會員資料" });
      }
    } else {
      return res.status(401).json({ success: false, error: "無效的 Token" });
    }
  } catch (error) {
    // 如果 token 驗證失敗或發生其他錯誤，返回沒有授權
    return res.status(401).json({ success: false, error: "無效的 Token", details: error.message });
  }
});


export default router;