import fs from 'fs/promises';
import path from 'path';

class JsonI18nService {
  constructor() {
    this.defaultLanguage = 'zh-TW';
    this.supportedLanguages = ['zh-TW', 'en-US', 'ja-JP'];
    this.translationsPath = path.join(process.cwd(), 'data', 'translations');
  }

  // 從請求中取得語言設定
  getLanguageFromRequest(req) {
    const queryLang = req.query.lang || req.query.language;
    if (queryLang && this.supportedLanguages.includes(queryLang)) {
      return queryLang;
    }

    const acceptLanguage = req.get('Accept-Language');
    if (acceptLanguage) {
      const preferredLang = acceptLanguage.split(',')[0].trim().split('-')[0];
      if (preferredLang === 'zh') return 'zh-TW';
      if (preferredLang === 'en') return 'en-US';
      if (preferredLang === 'ja') return 'ja-JP';
    }

    return this.defaultLanguage;
  }

  // 載入翻譯檔案
  async loadTranslations(languageCode) {
    try {
      const filePath = path.join(this.translationsPath, `${languageCode}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`無法載入語言檔案 ${languageCode}:`, error.message);
      return {};
    }
  }

  // 取得產品翻譯
  async getProductTranslation(productId, languageCode) {
    const translations = await this.loadTranslations(languageCode);
    return translations.products?.[productId] || null;
  }

  // 取得分類翻譯
  async getCategoryTranslation(categoryId, languageCode) {
    const translations = await this.loadTranslations(languageCode);
    return translations.categories?.[categoryId] || null;
  }

  // 取得品牌翻譯
  async getBrandTranslation(brandId, languageCode) {
    const translations = await this.loadTranslations(languageCode);
    return translations.brands?.[brandId] || null;
  }

  // 取得通用翻譯
  async getCommonTranslation(key, languageCode) {
    const translations = await this.loadTranslations(languageCode);
    return translations.common?.[key] || key;
  }

  // 翻譯產品資料
  async translateProduct(product, languageCode) {
    if (languageCode === this.defaultLanguage) {
      return product;
    }

    const translation = await this.getProductTranslation(product.pid, languageCode);
    if (!translation) {
      return product;
    }

    return {
      ...product,
      product_name: translation.name || product.product_name,
      product_description: translation.description || product.product_description,
      info: translation.info || product.info
    };
  }

  // 翻譯產品列表
  async translateProductList(products, languageCode) {
    if (languageCode === this.defaultLanguage) {
      return products;
    }

    const translatedProducts = [];
    for (const product of products) {
      const translated = await this.translateProduct(product, languageCode);
      translatedProducts.push(translated);
    }

    return translatedProducts;
  }

  // 翻譯分類資料
  async translateCategory(category, languageCode) {
    if (languageCode === this.defaultLanguage) {
      return category;
    }

    const translation = await this.getCategoryTranslation(category.cid, languageCode);
    if (!translation) {
      return category;
    }

    return {
      ...category,
      category_name: translation.name || category.category_name,
      category_description: translation.description || category.category_description
    };
  }

  // 翻譯品牌資料
  async translateBrand(brand, languageCode) {
    if (languageCode === this.defaultLanguage) {
      return brand;
    }

    const translation = await this.getBrandTranslation(brand.bid, languageCode);
    if (!translation) {
      return brand;
    }

    return {
      ...brand,
      brand_name: translation.name || brand.brand_name,
      brand_description: translation.description || brand.brand_description
    };
  }

  // 更新翻譯檔案
  async updateTranslation(languageCode, section, key, value) {
    try {
      const filePath = path.join(this.translationsPath, `${languageCode}.json`);
      let translations = {};
      
      try {
        const data = await fs.readFile(filePath, 'utf8');
        translations = JSON.parse(data);
      } catch (error) {
        // 檔案不存在，建立新的
      }

      if (!translations[section]) {
        translations[section] = {};
      }

      translations[section][key] = value;

      // 確保目錄存在
      await fs.mkdir(this.translationsPath, { recursive: true });
      
      // 寫入檔案
      await fs.writeFile(filePath, JSON.stringify(translations, null, 2), 'utf8');
      
      return true;
    } catch (error) {
      console.error('更新翻譯檔案失敗:', error);
      return false;
    }
  }

  // 取得翻譯統計
  async getTranslationStats() {
    const stats = {};
    
    for (const lang of this.supportedLanguages) {
      if (lang === this.defaultLanguage) continue;
      
      try {
        const translations = await this.loadTranslations(lang);
        stats[lang] = {
          products: Object.keys(translations.products || {}).length,
          categories: Object.keys(translations.categories || {}).length,
          brands: Object.keys(translations.brands || {}).length,
          common: Object.keys(translations.common || {}).length
        };
      } catch (error) {
        stats[lang] = { products: 0, categories: 0, brands: 0, common: 0 };
      }
    }
    
    return stats;
  }
}

export default new JsonI18nService(); 