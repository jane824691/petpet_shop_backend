import express from "express";
import db from "./../utils/connect-mysql.js"; //當前位置再回上一層
import upload from "./../utils/upload-imgs.js";
import bcrypt from "bcryptjs";
// import multer from "multer";

const router = express.Router();

// 設定 multer 上傳的存儲引擎和路徑
// const storage = multer.memoryStorage();  // 這裡使用 memoryStorage()，也可以設定其他存儲方式
// const upload = multer({ storage: storage });


  
  router.get("/api", async (req, res) => {
    res.json(await getListData(req));
    /*
    //暫時註解掉，啟用token功能時需打開
    // ?表示不確定有沒有jwt(但確定有前面屬性)，若有jwt&後面屬性就給資料。
    if(res.locals.jwt?.id){
      return res.json(await getListData(req));
    } else {
      return res.json({success: false, error: "沒有授權, 不能取得資料"});
    }
    */
  });

  //可以解析multipart/form-data
  router.post("/add",upload.single('photo'), async (req, res) => {
    const output = {
      success: false,
      postData: req.body, // 除錯用
    };
    

    //塞資料第一種用法
    const {lastname, firstname, email, mobile, birthday, account, password, identification, zipcode, address, photo,township,country} = req.body;
    
    //bcrypt加鹽放入資料庫
    const hash = await bcrypt.hash(password, 8);
  
  const sql = "INSERT INTO `profile`(`lastname`,`firstname`, `email`, `mobile`, `birthday`, `account`,`password`,`identification`, `country`,`township`,`zipcode`,`address`,`photo`,`created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,NOW() )";
  //塞入對應欄位的?值並顯示當前建立時間
  console.log('eddie',req.file);
  try {
  const [result] = await db.query(sql, 
    [ lastname, 
      firstname, 
      email, 
      mobile, 
      birthday,
      account,
      hash, 
      identification,
      country,
      township,
      zipcode,
      address,
      req.file.filename //圖片是否存在
    ]);
    output.result = result;
    output.success = !! result.affectedRows; //資料正確的話執行 (轉換布林值)

  } catch (ex) {
    // output.exception = ex; //資料錯誤的話執行
    output.exception = {
      message: ex.message,
      stack: ex.stack,
    };
  }
  console.log(output);
    res.json(output);
    });
  
    export default router;

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