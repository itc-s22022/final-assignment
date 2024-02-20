const passport = require("passport");
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { validationResult, check } = require('express-validator');
const { calcHash, generateSalt } = require('../util/auth')



const prisma = new PrismaClient();

/**
 * ログイン状態チェック
 */
router.get("/check", (req, res, next) => {
  if (!req.user) {
    // 未ログインなら、Error オブジェクトを作って、ステータスを設定してスロー
    const err = new Error("NG");
    err.status = 401;
    throw err;
  }
  // ここに来れるなら、ログイン済み。
  res.json({
    message: "logged in"
  });
});

/**
 * ユーザ認証
 */
router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) { return next(err); }
    if (!user) {
      return res.status(401).json({ message: "NG" });
    }
    req.logIn(user, (err) => {
      if (err) { return next(err); }
      res.status(200).json({
        message: "OK",
        isAdmin: user.isAdmin
      });
    });
  })(req, res, next);
});

router.get("/login", (req, res) => {
  res.render("login"); // ユーザ登録ページを表示するための処理を追加する
});

/**
 * ユーザ新規作成
 */
router.post("/register", [
  // 入力値チェックミドルウェア
  check("email").notEmpty({ ignore_whitespace: true }),
  check("name").notEmpty({ ignore_whitespace: true }),
  check("password").notEmpty({ ignore_whitespace: true })
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, name, password } = req.body;
  const salt = generateSalt();
  const hashed = calcHash(password, salt);

  try {
    await prisma.users.create({
      data: {
        email,
        name,
        password: hashed,
        salt: salt
      }
    });
    return res.status(201).json({ message: "created!" });
  } catch (e) {
    switch (e.code) {
      case "P2002":
        return res.status(400).json({ message: "username is already registered" });
      default:
        console.error(e);
        return res.status(500).json({ message: "unknown error" });
    }
  }
});

router.get("/register", (req, res) => {
  res.render("signup"); // ユーザ登録ページを表示するための処理を追加する
});

router.get("/logout", (req, res, next) =>  {
  req.logout((err) => {
    res.status(200).json({message: "OK"});
  });
});



module.exports = router;