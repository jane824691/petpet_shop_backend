import { getTranslation } from './i18n.js';

/**
 * 根據語言設定處理商品資料的國際化
 * @param {Array} products - 商品陣列
 * @param {string} language - 語言代碼 ('zh-TW' 或 'en-US')
 * @returns {Array} 處理後的商品陣列
 */
export const localizeProducts = (products, language = 'zh-TW') => {
  if (!Array.isArray(products)) {
    return products;
  }

  return products.map(product => localizeProduct(product, language));
};

/**
 * 處理單一商品的國際化
 * @param {Object} product
 * @param {string} language
 * @returns {Object}
 */
export const localizeProduct = (product, language = 'zh-TW') => {
  if (!product) return product;
  const localizedProduct = { ...product };

  if (language === 'en-US') {
    // 英文優先，沒有時 fallback 中文
    localizedProduct.product_name = product.product_name_en || product.product_name;
    localizedProduct.product_description = product.product_description_en || product.product_description;
  } else {
    // 只回傳純中文
    localizedProduct.product_name = product.product_name;
    localizedProduct.product_description = product.product_description;

    const { product_name, product_description, pid, category_id, product_price, product_img } = localizedProduct;

    return {
      pid,
      category_id,
      product_name,
      product_price,
      product_img,
      product_description,
    };
  }

  return localizedProduct;
};

/**
 * 將中文銷售狀態轉換為翻譯鍵值
 * @param {string} salesCondition - 銷售狀態
 * @returns {string} 翻譯鍵值
 */
const getSalesConditionKey = (salesCondition) => {
  const conditionMap = {
    '可購買': 'available',
    '已售完': 'sold_out',
    '已下架': 'discontinued'
  };
  
  return conditionMap[salesCondition] || 'available';
};

/**
 * 構建搜尋條件，支援多語言搜尋
 * @param {string} searchWord - 搜尋關鍵字
 * @param {string} language - 語言代碼
 * @returns {string} SQL WHERE 條件
 */
export const buildSearchCondition = (searchWord, language = 'zh-TW') => {
  if (!searchWord) return '';
  
  const escapedSearch = `%${searchWord}%`;
  
  if (language === 'zh-TW') {
    // 中文搜尋：優先搜尋中文欄位，如果沒有結果則搜尋英文欄位
    return `AND (product_name LIKE '${escapedSearch}' OR product_description LIKE '${escapedSearch}')`;
  } else {
    // 英文搜尋：搜尋英文欄位
    return `AND (product_name_en LIKE '${escapedSearch}' OR product_description_en LIKE '${escapedSearch}' OR product_name LIKE '${escapedSearch}' OR product_description LIKE '${escapedSearch}')`;
  }
}; 