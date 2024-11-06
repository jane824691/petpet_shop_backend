import express from "express";
import db from "../utils/connect-mysql.js";
import jwt from "jsonwebtoken";
import dayjs from "dayjs";
import upload from "./../utils/upload-imgs.js";
import admin from './../utils/connect-firebase.js';
import { v4 as uuidv4 } from "uuid";

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


const bucket = admin.storage().bucket();

router.put("/edit", upload.single('photo'), async (req, res) => {
  const output = {
      success: false,
      postData: req.body, // 除錯用
  };

  try {
      const { sid } = req.body;

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
          const blob = bucket.file(`images/${uuidv4()}.${file.originalname.split('.').pop()}`);
          const blobStream = blob.createWriteStream({
              metadata: {
                  contentType: file.mimetype,
              }
          });

          // 處理上傳錯誤
          blobStream.on('error', (err) => {
              console.error(err);
              return res.status(500).send('Unable to upload image.');
          });

          // 等待上傳完成
          await new Promise((resolve, reject) => {
              blobStream.on('finish', async () => {
                  try {
                      const [signedUrl] = await blob.getSignedUrl({
                          action: 'read',
                          expires: '03-09-2491'
                      });
                      fileUrl = signedUrl; // 獲取上傳後的圖片 URL
                      resolve();
                  } catch (error) {
                      reject(error);
                  }
              });
              blobStream.end(file.buffer);
          });

          // 如果有新圖片，加入到 updatedFields
          updatedFields.photo = fileUrl;
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