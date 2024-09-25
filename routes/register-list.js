import express from "express";
import db from "./../utils/connect-mysql.js";
import upload from "./../utils/upload-imgs.js";
import bcrypt from "bcryptjs";
import admin from './../utils/connect-firebase.js';
import { v4 as uuidv4 } from "uuid";
import tinify from "tinify";

const router = express.Router();
tinify.key = process.env.TINYPNG_API_KEY;

  router.get("/api", async (req, res) => {
    res.json(await getListData(req));
    /*
    //暫時註解掉，啟用token功能時需打開
    // 表示不確定有沒有jwt(但確定有前面屬性)，若有jwt&後面屬性就給資料。
    if(res.locals.jwt?.id){
      return res.json(await getListData(req));
    } else {
      return res.json({success: false, error: "沒有授權, 不能取得資料"});
    }
    */
  });

  // 首先要先建立 Storage 的 Bucket(儲存桶)
  const bucket = admin.storage().bucket();
  
  // 純firebase上傳測試, without 存 MYSQL
  router.post('/image', upload.single('file'), function (req, res) {
    try {
      // 檢查是否有檔案
      if (!req.file) {
          return res.status(400).send('No file uploaded.');
      }

      // 取得上傳的檔案資訊
      const file = req.file;

      // 上傳圖片到 TinyPNG 並壓縮
      tinify.fromBuffer(file.buffer).toBuffer(function(err, resultData) {
      if (err) throw err;

      // 基於檔案的原始名稱建立一個 blob 物件，並使用 uuid 重新命名
      const blob = bucket.file(`images/${uuidv4()}.${file.originalname.split('.').pop()}`);
        
      // 建立 Firebase 上傳流
      const blobStream = blob.createWriteStream({
          metadata: {
              contentType: file.mimetype, // 設置檔案類型
          }
      });

    // 上傳檔案到 Firebase Storage
    blobStream.on('error', (err) => {
        console.error(err);
        res.status(500).send('Unable to upload image.');
    });

    blobStream.on('finish', async () => {
        // 確保上傳完成後返回成功訊息
        const [fileUrl] = await blob.getSignedUrl({
            action: 'read',
            expires: '03-09-2491'
        });

        res.status(200).send({
            success: true,
            imgUrl: fileUrl,
            fileName: blob.name
        });
    });

    // 將檔案寫入
    blobStream.end(file.buffer);
  })

  } catch (err) {
      console.error(err);
      res.status(500).send('Server error occurred while uploading image.');
  }
  });
  // 刪除圖片測試
  router.delete('/image', function (req, res) {
    // 取得檔案名稱
    const fileName = req.query.fileName;
    // 取得檔案
    const blob = bucket.file(fileName);
    // 刪除檔案
    blob.delete().then(() => {
      res.send('刪除成功');
    }).catch((err) => {
      res.status(500).send('刪除失敗');
    });
  });

  // 真會員建立資料，圖片欄位為非必要選項
router.post("/add", upload.single('photo'), async (req, res) => {
    const output = {
        success: false,
        postData: req.body, // 除錯用
    };

    try {
        // bcrypt 加密密碼
        const hash = await bcrypt.hash(req.body.password, 8);

        // 取得會員資料
        const { lastname, firstname, email, mobile, birthday, account, identification, zipcode, address, township, country } = req.body;

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
        }

        // 構建 SQL 插入語句，圖片為可選欄位
        // 插入時間為CONVERT_TZ(NOW()是為了配合zeabur這個雲服務端的伺服器時間跟台灣時區不同，改用UNIX_TIMESTAMP()可存時間戳
        const sql = `INSERT INTO profile 
        (lastname, firstname, email, mobile, birthday, account, password, identification, country, township, zipcode, address, photo, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CONVERT_TZ(NOW(), '+00:00', '+08:00'))`;

        const params = [
            lastname, firstname, email, mobile, birthday, account, hash, identification,
            country, township, zipcode, address, fileUrl // 如果沒有圖片，fileUrl 為 null
        ];

        // 插入資料到 MySQL
        const [result] = await db.query(sql, params);

        // 檢查是否成功插入資料
        if (result.affectedRows > 0) {
            output.success = true;
            output.result = result;
            output.photo = fileUrl; // 如果有圖片，返回其 URL
        } else {
            throw new Error('Failed to insert data into MySQL.');
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

  //可以解析multipart/form-data
  // router.post("/add",upload.single('photo'), async (req, res) => {
  //   const output = {
  //     success: false,
  //     postData: req.body, // 除錯用
  //   };
    

  //   //塞資料第一種用法
  //   const {lastname, firstname, email, mobile, birthday, account, password, identification, zipcode, address, photo,township,country} = req.body;
    
  //   //bcrypt加鹽放入資料庫
  //   const hash = await bcrypt.hash(password, 8);
  
  // const sql = "INSERT INTO `profile`(`lastname`,`firstname`, `email`, `mobile`, `birthday`, `account`,`password`,`identification`, `country`,`township`,`zipcode`,`address`,`photo`,`created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,NOW() )";
  // //塞入對應欄位的?值並顯示當前建立時間

  // try {
  // const [result] = await db.query(sql, 
  //   [ lastname, 
  //     firstname, 
  //     email, 
  //     mobile, 
  //     birthday,
  //     account,
  //     hash, 
  //     identification,
  //     country,
  //     township,
  //     zipcode,
  //     address,
  //     req.file.filename //圖片是否存在
  //   ]);
  //   output.result = result;
  //   output.success = !! result.affectedRows; //資料正確的話執行 (轉換布林值)

  // } catch (ex) {
  //   // output.exception = ex; //資料錯誤的話執行
  //   output.exception = {
  //     message: ex.message,
  //     stack: ex.stack,
  //   };
  // }
  // console.log(output);
  //   res.json(output);
  //   });
  
  //   export default router;

  //塞資料第二種用法
  /*const sql = "INSERT INTO `address_book` SET ?";   //全部欄位塞?值再填入
  // INSERT INTO `address_book` SET `name`='abc',
  req.body.created_at = new Date(); //因資料顯示不正確(0000-00-00)，created_at欄位手動添加
  const[result] = await db.query(sql, [req.body]);
  */

  /*
  {
    "fieldCount": 0,
    "affectedRows": 1,  # 影響的列數(新增/刪除)
    "insertId": 1021,   # 取得的 PK (訂單編號)
    "info": "",
    "serverStatus": 2,
    "warningStatus": 0,
    "changedRows": 0    # 修改時真正有變動的資料筆數
  }
  */



  //upload.single(),upload.array(),upload.any(),upload.none()
  //表單送出的三種格式:urlencoded,multipart/form-data,json

  /*第一種處理法
  router.post("/add", upload.none(), async (req, res) => { //此為multipart/form-data格式，需特別處理
    res.json(req.body);
  });
  */

  /*第二種&第三種處理法
  router.post("/add", async (req, res) => { //此為urlencoded&Json格式
    res.json(req.body);
  });
  */

  /*
  const sql = "SELECT * FROM address_book ORDER BY sid DESC LIMIT 5";
  const [rows] = await db.query(sql);
  res.json(rows);
  */