const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const app = express();
const mongoose = require("mongoose");
const session = require("express-session");
const url = "http://localhost:8080/login?token=";
const crypto = require("crypto");

app.use(bodyParser.json());
app.set("view engine", "pug");
app.set("views", "./views");
app.use(express.static("static"));

mongoose.connect("mongodb://mongodb/Gradebook");
const db = mongoose.connection;
db.on("error", (err) => {
    console.log("mongodb connection error: ", err);
});
db.on("connected", () => {
    console.log("mongodb connected successfully");
});

const userSchema = new mongoose.Schema({
    uid: Number,
    email: String,
    secret: String,
    timestamp: String,
});

const courseSchema = new mongoose.Schema({
    uid: Number,
    course: String,
    assign: String,
    score: Number,
});

var myusers = mongoose.model("users", userSchema, "users");
var mycourses = mongoose.model("courses", courseSchema, "courseinfo");

const transporter = nodemailer.createTransport({
    host: "testmail.cs.hku.hk",
    port: 25,
    secure: false,
});

const sessionSecret = crypto.randomBytes(8).toString("base64");
app.use(
    session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
    })
);

app.get("/login", function (req, res) {
    if (!req.query.token) {
        if (req.session?.expiry && Date.now() > req.session.expiry) {
            req.session.destroy((err) => {
                if (err) {
                    console.error("failed to destroy session: ", err);
                }
            });
            res.render("login", { action: "sessionExpired" });
        } else {
            res.render("login");
        }
    } else {
        const decoded = JSON.parse(
            Buffer.from(req.query.token, "base64").toString("utf-8")
        );
        const { uid, secret } = decoded;
        myusers.findOne({ uid: uid }).then(function (result) {
            if (!result) {
                res.render("login", { action: "unknownUser" });
            } else if (!(Date.now() - Number.parseInt(result.timestamp) <= 60000)) {
                res.render("login", { action: "otpExpired" });
            } else if (result.secret !== secret) {
                res.render("login", { action: "incorrectSecret" });
            } else {
                myusers
                    .findOneAndUpdate({ uid: uid }, { timestamp: "NULL", secret: "NULL" })
                    .catch((err) => {
                        console.error("error during findOneAndUpdate: ", err);
                    });

                req.session.uid = uid;
                req.session.expiry = Date.now() + 1000 * 300;
                res.redirect("/courseinfo/mylist");
            }
        });
    }
});

app.post("/login", function (req, res) {
    let email = req.body.email;
    myusers
        .findOne({ email: email })
        .then(function (result) {
            if (!result) {
                res.render("userNotFound", {
                    email: email,
                });
            } else {
                res.render("userFound");
                const { uid, email } = result;
                // generating secret
                var secret = crypto.randomBytes(8).toString("base64");
                var ts = new Date().getTime();
                myusers
                    .findOneAndUpdate(
                        { email: email },
                        { timestamp: ts.toString(), secret: secret }
                    )
                    .catch((err) => {
                        console.error("error during findOneAndUpdate: ", err);
                    });

                let userToken = JSON.stringify({ uid, secret });
                let encodedToken = Buffer.from(userToken).toString("base64");
                //sending email
                var message = {
                    from: "gradebook@connect.hku.hk",
                    to: email,
                    subject: "Your Login Link",
                    html: `<p>Dear Student, <br/>You can log on to the system via the following link: <br/>${url + encodedToken
                        }</p>`,
                };

                transporter.sendMail(message, (error, info) => {
                    if (error) {
                        console.error("Email send failed: " + error.message);
                    }
                });
            }
        })
        .catch((err) => {
            console.error("error during mongoose find: ", err);
        });
});

app.get("/courseinfo/mylist", function (req, res) {
    if (!req?.session?.uid || Date.now() > req?.session?.expiry) {
        res.redirect("/login"); //redirects if session expired or does not exist
    } else {
        mycourses
            .find({ uid: req.session.uid })
            .then((result) => {
                let courseNames = [];
                result.forEach((doc) => {
                    if (!courseNames.includes(doc.course)) {
                        courseNames.push(doc.course);
                    }
                });
                res.render("mylist", { courseUnique: courseNames });
            })
            .catch((err) => {
                console.error("error during mycourses find: ", err);
            });
    }
});

app.get("/courseinfo/getscore", function (req, res) {
    if (!req?.session?.uid || Date.now() > req?.session?.expiry) {
        res.redirect("/login"); //redirects if session expired or does not exist
    } else {
        if (!req.query?.course) {
            throw new Error("your /courseinfo/getscore is missing a course query");
        } else {
            mycourses
                .find({ uid: req.session.uid, course: req.query.course })
                .then((result) => {
                    if (result.length === 0){
                        res.render("noscore", {course: req.query.course});
                    } else {
                        let assignScore = [];
                        total = 0;
                        result.forEach((doc) => {
                            let t = [doc.assign, doc.score];
                            if (!assignScore.includes(t)) {
                                total += doc.score;
                                assignScore.push(t);
                            }
                        });
                        res.render("getscore", {
                            assn: assignScore,
                            total: total,
                            course: req.query.course,
                        });
                    }

                })
                .catch((err) => {
                    console.error("error during getcourse find: ", err);
                });
        }
    }
});

app.use(function (req, res, next) {
    res.status(404).send("404 not found");
});

app.use(function (err, req, res, next) {
    console.log(err);
    res.status(500);
    res.send("Internal server error. view terminal for info");
});

app.listen(8080, function () {
    console.log("Express app listening on port 8080");
});
