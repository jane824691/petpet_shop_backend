import productService from "../services/productService.js";

class ProductController {
    async createProduct(req, res) {
        const output = {
            success: false,
            postData: req.body,
        };

        const {
            categoryId,
            nameZh,
            nameEn,
            price,
            stock,
            descriptionZh,
            descriptionEn,
            productImg,
            images,
        } = req.body;

        try {
            const result = await productService.createProduct(
                {
                    categoryId,
                    nameZh,
                    nameEn,
                    price,
                    stock,
                    descriptionZh,
                    descriptionEn,
                    productImg,
                    images,
                },
                req.files
            );

            output.success = true;
            output.result = result;
            res.json(output);
        } catch (err) {
            console.error(err);
            output.exception = {
                message: err.message,
                stack: err.stack,
            };
            res.status(500).json(output);
        }
    }
}

export default new ProductController();
