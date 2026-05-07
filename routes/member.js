import express from "express";
import db from "../utils/connect-mysql.js";
import jwt from "jsonwebtoken";
import upload from "./../utils/upload-imgs.js";
import admin from './../utils/connect-firebase.js';
import { v4 as uuidv4 } from "uuid";
import tinify from "tinify";
tinify.key = process.env.TINYPNG_API_KEY;

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

// JWT 或 session 任一通過即可
const getAuthSid = (req, res) => {
  if (res.locals.jwt?.sid) return res.locals.jwt.sid;
  if (req.session?.user?.sid) return req.session.user.sid;

  // 相容舊用法：req.body.token
  const bodyToken = req.body?.token;
  if (bodyToken) {
    try {
      const decoded = jwt.verify(bodyToken, process.env.JWT_SECRET);
      res.locals.jwt = decoded;
      if (decoded?.sid) return decoded.sid;
    } catch (_) { }
  }
  return null;
};

router.post("/", async (req, res) => {
  const sid = getAuthSid(req, res);
  if (!sid) {
    return res.status(401).json({ success: false, error: "沒有授權，不能取得資料" });
  }

  try {
    const [rows] = await db.query(`SELECT * FROM profile WHERE sid = ?`, [sid]);
    if (rows.length) {
      return res.json(rows[0]);
    }
    return res.status(404).json({ message: "找不到會員資料" });
  } catch (error) {
    return res.status(500).json({ success: false, error: "伺服器錯誤", details: error.message });
  }
});


const bucket = admin.storage().bucket();

router.put("/edit", upload.single('photo'), async (req, res) => {
  const output = {
      success: false,
      postData: req.body, // 除錯用
  };

  const sid = getAuthSid(req, res);
  if (!sid) {
    return res.status(401).json({ success: false, error: "沒有授權，不能取得資料" });
  }

  try {

      // 只更新有改動的欄位
      const updatedFields = {};
      if (req.body.firstname) updatedFields.firstname = req.body.firstname;
      if (req.body.lastname) updatedFields.lastname = req.body.lastname;
      if (req.body.mobile) updatedFields.mobile = req.body.mobile;
      if (req.body.country) updatedFields.country = req.body.country;
      if (req.body.township) updatedFields.township = req.body.township;
      if (req.body.zipcode) updatedFields.zipcode = req.body.zipcode;
      if (req.body.identification) updatedFields.identification = req.body.identification;
      if (req.body.email) updatedFields.email = req.body.email;
      if (req.body.birthday) updatedFields.birthday = req.body.birthday;
      if (req.body.address) updatedFields.address = req.body.address;

      let fileUrl = null;
      const file = req.file; // 檢查是否有上傳圖片

      // 如果有上傳圖片，處理圖片上傳到 Firebase Storage
      if (file) {
          try {
              // 壓縮圖片：使用 TinyPNG
              const compressedBuffer = await tinify.fromBuffer(file.buffer).toBuffer();
          
              // 上傳壓縮後的圖片到 Firebase Storage
              const blob = bucket.file(`images/${uuidv4()}.${file.originalname.split('.').pop()}`);
              const blobStream = blob.createWriteStream({
                  metadata: {
                      contentType: file.mimetype,
                  }
              });
            
              // 上傳處理
              await new Promise((resolve, reject) => {
                  blobStream.on('error', reject);
                  blobStream.on('finish', async () => {
                      try {
                          const [signedUrl] = await blob.getSignedUrl({
                              action: 'read',
                              expires: '03-09-2491'
                          });
                          fileUrl = signedUrl;
                          resolve();
                      } catch (error) {
                          reject(error);
                      }
                  });
                
                  // 將壓縮後的圖片寫入 Firebase
                  blobStream.end(compressedBuffer);
              });
            
              updatedFields.photo = fileUrl;
            
          } catch (err) {
              console.error("圖片壓縮或上傳錯誤:", err);
              return res.status(500).json({ success: false, message: "圖片處理失敗", error: err.message });
          }
      }

      // 如果沒有需要更新的欄位，直接返回成功
      if (Object.keys(updatedFields).length === 0) {
          return res.status(400).json({ success: false, message: 'No fields to update.' });
      }

      // 構建 SQL 動態更新語句
      const sqlSet = Object.keys(updatedFields).map(key => `${key}=?`).join(', ');
      const sql = `UPDATE profile SET ${sqlSet} WHERE sid=?`;
      const params = [...Object.values(updatedFields), sid];

      // 更新資料到 MySQL
      const [result] = await db.query(sql, params);

      // 檢查是否成功更新資料
      if (result.affectedRows > 0) {
          output.success = true;
          output.result = result;
          output.photo = fileUrl; // 如果有新圖片，返回其 URL
      } else {
          throw new Error('Failed to update data in MySQL.');
      }

      return res.status(200).json(output);
  } catch (err) {
      console.error(err);
      output.exception = {
          message: err.message,
          stack: err.stack,
      };
      res.status(500).json(output);
  }
});


export default router;