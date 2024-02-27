const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const loginCheck = (req, res, next) => {
    if (!req.user) {
        req.session.returnTo = "/book";
        res.redirect("/users/login");
        return;
    }
    next();
};

router.post('/start', loginCheck, async (req, res) => {
    try {
        const bookId = req.body.bookId;

        // 貸出データベース内で指定された書籍が既に貸し出されているか確認
        const existingRental = await prisma.rental.findFirst({
            where: {
                bookId: bookId,
                returnDate: null // returnDateがnullのレコードを検索
            }
        });

        if (existingRental) {
            // 本が貸出中の場合は409を返す
            return res.status(409).json({ message: "貸出中のため失敗" });
        }

        // 貸出処理を行う
        const createRental = await prisma.rental.create({
            data: {
                bookId: bookId,
                userId: req.user.id,
                rentalDate: new Date(),
                returnDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7日後の日時を返却期限とする
                returnDate: null
            }
        });

        const response = {
            message: "貸出成功",
            rental: {
                id: createRental.id,
                bookId: createRental.bookId,
                rentalDate: createRental.rentalDate,
                returnDeadline: createRental.returnDeadline,
                returnDate: createRental.returnDate
            }
        };

        // レスポンスを返す
        res.status(201).json(response);

    } catch (error) {
        // エラーが発生した場合は500を返す
        console.error("Error starting rental:", error);
        return res.status(500).json({ message: "貸出処理中にエラーが発生しました。" });
    }
});

router.put('/return', loginCheck, async (req, res) => {
    try {
        const rentalId = req.body.rentalId; // リクエストボディからrentalIdを取得

        // 貸出情報を取得
        const rental = await prisma.rental.findUnique({
            where: {
                id: rentalId,
                userId: req.user.id,
                returnDate: null
            }
        });

        if (!rental) {
            return res.status(404).json({result: "NG"})
        }

        // rentalIdが存在しない場合
        if (rental) {
            const returnedRental = await prisma.rental.update({
                where: {
                    id: rental.id
                },
                data: {
                    returnDate: new Date()
                }
            });
            return res.status(200).json({result: "OK"});
        } else {
            return res.status(404).json({result: "NG"})
        }

    } catch (error) {
        console.error("Error returning book:", error);
        res.status(400).json({ result: "NG", message: "書籍の返却中にエラーが発生しました" });
    }
});


router.get('/current', loginCheck, async (req, res) => {
    try {
        const userId = req.user.id;

        // ログインユーザが借用している書籍の一覧を取得
        const rentalBooks = await prisma.rental.findMany({
            where: {
                userId: userId,
                returnDate: null // 返却日がnullのものを取得
            },
            include: {
                books: {
                    select: {
                        id: true,
                        title: true
                    }
                },
                // rentalDateとreturnDeadlineをincludeステートメント内に移動
            }
        });

        // 借用書籍一覧の形式に整形
        const formattedRentalBooks = rentalBooks.map(rental => ({
            rentalId: rental.id,
            bookId: rental.books.id,
            bookName: rental.books.title,
            rentalDate: rental.rentalDate, // rentalDateがrentalオブジェクトに直接含まれているため修正不要
            returnDeadline: rental.returnDeadline // returnDeadlineがrentalオブジェクトに直接含まれているため修正不要
        }));

        // レスポンスを返す
        res.status(200).json({ rentalBooks: formattedRentalBooks });
    } catch (error) {
        console.error("Error fetching rental books:", error);
        res.status(500).json({ message: "借用書籍一覧の取得中にエラーが発生しました" });
    }
});


router.get('/history', loginCheck, async (req, res) => {
    try {
        const userId = req.user.id;

        // ログインユーザの借用書籍履歴を取得
        const rentalHistory = await prisma.rental.findMany({
            where: {
                userId: userId,
                returnDate: {
                    not: null
                }
            },
            include: {
                books: {
                    select: {
                        id: true,
                        title: true
                    }
                }
            }
        });

        // 借用書籍履歴の形式に整形
        const formattedRentalHistory = rentalHistory.map(rental => ({
            rentalId: rental.id,
            bookId: rental.books.id,
            bookName: rental.books.title,
            rentalDate: rental.rentalDate, // ここでrentalDateを取得
            returnDate: rental.returnDate // ここでreturnDateを取得
        }));

        // レスポンスを返す
        res.status(200).json({ rentalHistory: formattedRentalHistory });
    } catch (error) {
        console.error("Error fetching rental history:", error);
        res.status(500).json({ message: "借用書籍の履歴の取得中にエラーが発生しました" });
    }
});



module.exports = router;
