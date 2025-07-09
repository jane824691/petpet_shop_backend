# 寵物商城後端國際化 (i18n) 功能說明

## 概述

本專案已實現商品列表的語言國際化功能，支援中文 (zh-TW) 和英文 (en-US) 兩種語言。

## 功能特色

1. **多語言商品資訊**: 商品名稱和描述支援中英文切換
2. **智慧搜尋**: 根據語言設定搜尋對應語言的商品資訊
3. **狀態翻譯**: 商品銷售狀態自動翻譯
4. **彈性語言檢測**: 支援多種方式設定語言

## 資料庫結構

已新增以下欄位到 `product` 表：
```sql
ALTER TABLE product ADD COLUMN product_name_en VARCHAR(255);
ALTER TABLE product ADD COLUMN product_description_en VARCHAR(1000);
```

## API 使用方式

### 1. 設定語言

前端可以透過以下方式傳遞語言設定：

#### 方式一：查詢參數
```
GET /product/api?lang=en-US
GET /product/api?lang=zh-TW
```

#### 方式二：請求標頭
```
Accept-Language: en-US
Accept-Language: zh-TW
```

#### 方式三：會話變數
```javascript
req.session.lang = 'en-US';
```

### 2. API 端點

#### 商品列表
```
GET /product/api?lang=en-US&page=1
```

#### 單一商品
```
GET /product/one/1?lang=en-US
```

#### 推薦商品
```
GET /product/recommend?lang=en-US
```

#### 測試國際化功能
```
GET /product/test-i18n?lang=en-US
```

## 檔案結構

```
utils/
├── i18n.js                    # i18n 配置和語言中間件
└── product-i18n.js           # 商品國際化處理函數

data/translations/
├── zh-TW/
│   ├── common.json           # 中文通用翻譯
│   └── products.json         # 中文商品翻譯
└── en-US/
    ├── common.json           # 英文通用翻譯
    └── products.json         # 英文商品翻譯

routes/
└── product.js               # 已修改支援國際化
```

## 翻譯檔案格式

### common.json
```json
{
  "errors": {
    "unauthorized": "沒有授權，不能取得資料",
    "notFound": "找不到資料"
  },
  "status": {
    "success": "成功",
    "failed": "失敗"
  }
}
```

### products.json
```json
{
  "product": {
    "name": "商品名稱",
    "description": "商品描述",
    "sales_condition": {
      "available": "可購買",
      "sold_out": "已售完",
      "discontinued": "已下架"
    }
  }
}
```

## 回傳資料格式

### 商品列表回應
```json
{
  "success": true,
  "page": 1,
  "perPage": 12,
  "rows": [
    {
      "pid": 1,
      "product_name": "英文商品名稱", // 根據語言自動選擇
      "product_description": "英文商品描述",
      "sales_condition": "可購買",
      "sales_condition_localized": "Available" // 翻譯後的狀態
    }
  ],
  "totalRows": 100,
  "totalPages": 9
}
```

## 搜尋功能

### 中文搜尋
- 搜尋 `product_name` 和 `product_description` 欄位

### 英文搜尋
- 優先搜尋 `product_name_en` 和 `product_description_en` 欄位
- 如果沒有結果，會回退到搜尋中文欄位

## 測試

### 1. 啟動伺服器
```bash
npm run dev
```

### 2. 測試國際化功能
```bash
node test-i18n.js
```

### 3. 手動測試 API
```bash
# 測試中文
curl "http://localhost:3000/product/test-i18n?lang=zh-TW"

# 測試英文
curl "http://localhost:3000/product/test-i18n?lang=en-US"
```

## 後續擴展

1. **會員資訊國際化**: 擴展到會員相關 API
2. **訂單國際化**: 擴展到訂單相關 API
3. **評論國際化**: 擴展到商品評論 API
4. **更多語言支援**: 新增其他語言

## 注意事項

1. 確保資料庫中的 `product_name_en` 和 `product_description_en` 欄位已填入英文資料
2. 如果英文欄位為空，系統會自動回退到中文欄位
3. 翻譯檔案修改後需要重啟伺服器才能生效
4. 建議在生產環境中關閉 debug 模式 (`debug: false`)

## 故障排除

### 問題：翻譯沒有生效
- 檢查翻譯檔案路徑是否正確
- 確認語言代碼格式 (`zh-TW`, `en-US`)
- 重啟伺服器

### 問題：搜尋功能異常
- 檢查資料庫欄位是否存在
- 確認 SQL 查詢語法

### 問題：API 回應錯誤
- 檢查 i18n 配置檔案
- 確認中間件是否正確載入 