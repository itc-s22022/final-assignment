const {PrismaClient} = require('@prisma/client');
const express = require("express")
const router = express.Router();

const prisma = new PrismaClient();

router.post("/book/create", async (req, res) => {
    const { isbn13, title, author, publishDate } = req.body;

    try {
        // 書籍を作成し、結果を取得
        const createdBook = await prisma.books.create({
            data: {
                isbn13,
                title,
                author,
                publishDate
            }
        });

        // 登録成功のレスポンスを返す
        res.status(201).json({ result: "OK" });
    } catch (error) {
        // エラーが発生した場合はエラーレスポンスを返す
        console.error("Error creating book:", error);
        res.status(400).json({ result: "NG", error: error.message });
    }
});

module.exports = router;