const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const loginCheck = (req, res, next) => {
    if (!req.user) {
        req.session.returnTo = "/book/list"; // 書籍一覧ページにリダイレクトする
        res.redirect("/users/login");
        return;
    }
    next();
};



// 書籍一覧取得エンドポイント
router.get('/list', loginCheck, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // ページ番号を取得し、ない場合は1とする

        // 1ページあたりの書籍数として定義された値
        const itemsPerPage = 4;

        // 書籍を取得するためのオフセットを計算
        const offset = (page - 1) * itemsPerPage;

        // 書籍一覧を取得するクエリ
        const books = await prisma.books.findMany({
            skip: offset, // オフセットを設定
            take: itemsPerPage, // 取得する書籍数を設定
            orderBy: { id: 'asc' }, // ID順に並べ替え
            select: { id: true, title: true, author: true } // 必要なフィールドのみを選択
        });

        // 書籍数を取得
        const totalBooks = await prisma.books.count();

        // 最大ページ数を計算
        const maxPage = Math.ceil(totalBooks / itemsPerPage);

        // 貸出中の書籍を取得
        const rentalBooks = await prisma.rental.findMany({
            where: {
                returnDate: null // 返却日がnullのものを取得
            },
            select: {
                bookId: true
            }
        });

        // 貸出中の書籍IDをセットにして、貸出中の書籍IDを保持
        const rentedBookIds = new Set(rentalBooks.map(rental => rental.bookId));

        // 書籍一覧に貸出中のフラグを追加
        const formattedBooks = books.map(book => ({
            id: book.id,
            title: book.title,
            author: book.author,
            isRental: rentedBookIds.has(book.id) ? true : false // 貸出中の書籍IDが含まれているかどうかで判断
        }));

        // レスポンスを返す
        res.status(200).json({ books: formattedBooks, maxPage });
    } catch (error) {
        console.error("Error fetching book list:", error);
        res.status(500).json({ message: "書籍一覧の取得中にエラーが発生しました" });
    }
});



// 書籍詳細取得エンドポイント
router.get('/detail/:id', loginCheck, async (req, res) => {
    try {
        const bookId = parseInt(req.params.id);

        // 書籍詳細を取得するクエリ
        const bookDetail = await prisma.books.findUnique({
            where: {
                id: bookId,
            },
            select: {
                id: true,
                isbn13: true,
                title: true,
                author: true,
                publishDate: true,
            }
        });

        if (!bookDetail) {
            return res.status(404).json({ message: '書籍が見つかりません' });
        }

        res.status(200).json(bookDetail);
    } catch (error) {
        console.error('Error fetching book detail:', error);
        res.status(500).json({ message: '書籍詳細の取得中にエラーが発生しました' });
    }
});



module.exports = router;