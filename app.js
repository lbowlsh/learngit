const express = require('express');
const nodemailer = require('nodemailer');
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./openapi.yaml');


const app = express();
const port = 3000;

// app.use(bodyParser.json());

app.use(bodyParser.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// 添加根路径处理
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});


// 邮件发送者配置 - 使用 SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.263.net',
  port: 465, // 使用 SSL 加密端口
  secure: true, // 使用 SSL
  auth: {
    user: 'gitea@263global.com',
    pass: 'tR1.atRt'
  }
});

// IMAP 配置 - 接收邮件
const imapConfig = {
  user: 'gitea@263global.com',
  password: 'tR1.atRt',
  host: 'imap.263.net',
  port: 993, // 使用 SSL 加密端口
  tls: true // 使用 SSL
};

// 发送邮件 API
app.post('/send', (req, res) => {
  const { to, subject, text, html } = req.body;
  transporter.sendMail({
    from: 'gitea@263global.com',
    to,
    subject,
    text,
    html
  }, (err, info) => {
    if (err) {
      res.status(500).json({ message: 'Error sending email', err });
    } else {
      res.status(200).json({ message: 'Email sent', info });
    }
  });
});

// 接收邮件 API - 使用 IMAP
app.get('/receive', (req, res) => {
  const imap = new Imap(imapConfig);
  imap.once('ready', function() {
    imap.openBox('INBOX', false, function(err, box) {
      if (err) {
        res.status(500).json({ message: 'Error opening inbox', err });
        return;
      }
      imap.search(['UNSEEN', ['SINCE', new Date()]], function(err, results) {
        if (err || !results || !results.length) {
          res.status(404).json({ message: 'No new mails' });
          return;
        }
        const f = imap.fetch(results, { bodies: '' });
        const mails = [];
        f.on('message', function(msg, seqno) {
          msg.on('body', function(stream) {
            simpleParser(stream, (err, mail) => {
              if (err) {
                res.status(500).json({ message: 'Error parsing mail', err });
                return;
              }
              mails.push(mail);
            });
          });
        });
        f.once('error', function(err) {
          res.status(500).json({ message: 'Fetch error', err });
        });
        f.once('end', function() {
          res.status(200).json({ message: 'Mail received', mails });
          imap.end();
        });
      });
    });
  });
  imap.once('error', function(err) {
    res.status(500).json({ message: 'IMAP connection error', err });
  });
  imap.connect();
});

app.listen(port, () => {
  console.log(`Mail API server listening at http://localhost:${port}`);
  console.log(`Swagger UI is available at http://localhost:${port}/api-docs`);
});
