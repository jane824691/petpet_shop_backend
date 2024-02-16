-------------------------
res 回應不要使用兩次以上
-------------------------
res.end()
res.send()
res.json()
res.render()
res.redirect()
-------------------------
===================================
req 接收的資料
-----------------------------------
req.query   # query string
req.body    # 表單資料
req.file    # 上傳單一檔案
req.files   # 上傳多個檔案
req.params  # 路徑變數
req.session # session 物件
===================================

RESTful API
----------------------------------
GET:    /products       read, 讀取列表
GET:    /products/12    read, 讀取單筆
POST:   /products       create, 新增資料
PUT:    /products/12    update, 修改資料
DELETE: /products/12    delete, 刪除資料
===================================

same origin
----------------------------------
1. protocol 協定
2. domain 網域 (IP)
3. port 通訊埠
===================================