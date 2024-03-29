const {PrismaClient} = require('@prisma/client');
const express = require("express")
const router = express.Router();

const prisma = new PrismaClient();


const isAdmin = async (req, res, next) => {
    try {
        // ログイン中のユーザー情報を取得
        const currentUser = req.user;

        // req.user が未定義の場合のハンドリング
        if (!currentUser) {
            res.status(403).json({ result: 'NG', error: 'Permission denied. User not logged in.' });
            return;
        }

        // Prismaを使用してユーザーの権限を取得
        const user = await prisma.users.findUnique({
            where: { id: currentUser.id },
            select: { isAdmin: true } // isAdminがtrueかfalseで取得
        });

        if (user && user.isAdmin === true) {
            // ユーザーが管理者の場合
            next();
        } else {
            // ユーザーが管理者でない場合は権限エラー
            res.status(403).json({ result: 'NG', error: 'Permission denied. Must be an admin.' });
        }
    } catch (error) {
        console.error('Error during isAdmin check:', error);
        // エラーが発生した場合はエラーレスポンスを返す
        res.status(500).json({ result: 'NG', error: 'Internal server error.' });
    }
};


router.post("/book/create",  isAdmin, async (req, res) => {
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

router.put('/book/update', isAdmin, async (req, res) => {
    // リクエストデータを取得
    const { bookId, isbn13, title, author, publishDate } = req.body;

    try {
        // 書籍をデータベースから検索
        const existingBook = await prisma.books.findUnique({
            where: {
                id: bookId // bookIdに基づいて書籍を検索
            }
        });

        // 書籍が存在しない場合はエラーレスポンスを返す
        if (!existingBook) {
            return res.status(404).json({ result: "NG", error: "Book not found" });
        }

        // 書籍情報を更新し、結果を取得
        const updatedBook = await prisma.books.update({
            where: {
                id: bookId
            },
            data: {
                isbn13,
                title,
                author,
                publishDate
            }
        });

        // 更新成功のレスポンスを返す
        res.status(200).json({ result: "OK" });
    } catch (error) {
        // エラーが発生した場合はエラーレスポンスを返す
        console.error("Error updating book:", error);
        res.status(400).json({ result: "NG", error: error.message });
    }
});


router.get('/rental/current', isAdmin , async (req, res) => {
    try {
        // データベースから貸出中の書籍一覧を取得
        const rentalBooks = await prisma.rental.findMany({
            where: {
                returnDate: {
                    equals: null // returnDateがnullであるレコードを検索
                }
            },
            select: {
                rentalId: true,
                userId: true,
                userName: true,
                bookId: true,
                bookName: true,
                rentalDate: true,
                returnDeadline: true
            }
        });

        // 貸出中の書籍一覧をレスポンスとして返す
        res.status(200).json({ rentalBooks });
    } catch (error) {
        // エラーが発生した場合はエラーレスポンスを返す
        console.error("Error fetching rental books:", error);
        res.status(500).json({ error: "Failed to fetch rental books" });
    }
});



// 特定ユーザの貸出中書籍一覧を取得するエンドポイント
router.get('/rental/current/:uid', isAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.uid);

        // 特定ユーザが現在借りている書籍一覧を取得するクエリ
        const rentalBooks = await prisma.rental.findMany({
            where: {
                userId: userId,
                returnDate: null
            },
            select: {
                id: true,
                bookId: true,
                rentalDate: true,
                returnDeadline: true
            }
        });

        // 書籍情報を取得するクエリ
        const bookIds = rentalBooks.map(rental => rental.bookId);
        const books = await prisma.books.findMany({
            where: {
                id: {
                    in: bookIds
                }
            },
            select: {
                id: true,
                title: true
            }
        });

        // 特定ユーザの情報を取得するクエリ
        const user = await prisma.users.findUnique({
            where: {
                id: userId
            },
            select: {
                id: true,
                name: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: '指定されたユーザが見つかりません' });
        }

        // レスポンスを返す
        res.status(200).json({
            userId: user.id,
            userName: user.name,
            rentalBooks: rentalBooks.map(rental => {
                const book = books.find(book => book.id === rental.bookId);
                return {
                    rentalId: rental.id,
                    bookId: rental.bookId,
                    bookName: book ? book.title : 'Unknown', // 書籍が見つからない場合は'Unknown'を表示
                    rentalDate: rental.rentalDate,
                    returnDeadline: rental.returnDeadline
                };
            })
        });
    } catch (error) {
        console.error('Error fetching current rental books:', error);
        res.status(500).json({ message: '貸出中書籍の取得中にエラーが発生しました' });
    }
});








module.exports = router;