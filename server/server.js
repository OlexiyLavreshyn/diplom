const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const bodyParser = require('body-parser');
const path = require('path');

const { constrainedMemory } = require("process");

const app = express();
app.use(express.json());

const corsOptions = {
  origin: 'http://localhost:3000', // Replace with the actual origin of your React app
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // Allow credentials like cookies (if needed)
};

app.use(cors(corsOptions));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const transporter = nodemailer.createTransport({
    service: 'Gmail', // e.g., 'Gmail'
    auth: {
      user: 'alexxxx444422@gmail.com',
      pass: 'ymwbsagauhcbmifo',
    },
  });

  const con = mysql.createConnection(
    {
        user: "root",
        host: "localhost",
        password: "Jktrxsw2005",
        database: "diplom",
    }
)

function generateVerificationCode() {
    const min = 10000;
    const max = 99999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

con.connect(function(err) {
    if (err) {
      console.error('Error connecting to the database: ' + err.stack);
      return;
    }
    console.log('Connected to the database as id ' + con.threadId);
  });

  app.post('/register', async (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const plainPassword = req.body.password; // Get the plain text password
    const verificationCode = generateVerificationCode(); // Generate a 5-digit code
  
    console.log("Request received at /register");
  
    try {
      // Hash the password
      const saltRounds = 10; // You can adjust the number of salt rounds for security
      const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
  
      // Insert user data and hashed password along with the verification code into the database
      con.query(
        "INSERT INTO users (name, email, password, verification_code) VALUES (?, ?, ?, ?)",
        [name, email, hashedPassword, verificationCode],
        (err, result) => {
          if (result) {
            res.send(result);
          } else {
            res.send({ message: "ENTER CORRECT ASKED DETAILS!" });
          }
        }
      );
    } catch (err) {
      console.error("Error registering user: " + err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  });
  
  app.post('/login', async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
  
    con.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('Error querying the database: ' + err);
        return res.status(500).send({ message: 'Internal Server Error' });
      }
  
      if (results.length === 0) {
        console.log('no user');
        return res.status(401).send({ message: 'Wrong email' });
      }
  
      const user = results[0];
  
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (passwordMatch) {
        console.log('logged');
  
        if (!user.email_verified_at) {
          // Email is not verified, send the verification code and navigate to EmailVerification
          const verificationCode = user.verification_code;
          const emailMessage = `Your verification code is: ${verificationCode}`;
  
          const mailOptions = {
            from: '"LvivAirTravel.com" <alexxxx444422@gmail.com>',
            to: user.email,
            subject: 'Verification Code',
            text: emailMessage,
          };
  
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error('Error sending email: ' + error);
            } else {
              console.log('Email sent: ' + info.response);
            }
          });

          const token = jwt.sign(
            {
              userId: user.id,
              userName: user.name,
              email: user.email,
            },
            'jktrxsw2005',
            { expiresIn: '1h' }
          );
          console.log(token);
          console.log("111");
  
          res.status(200).send({ message: 'Email not verified', token, email_verified_at: null });
        } else {
          // Email is already verified, you can navigate to another page (e.g., MainPage)
          // Generate a JWT token with the user ID
          const token = jwt.sign(
            {
              userId: user.id,
              userName: user.name,
              email: user.email,
            },
            'jktrxsw2005',
            { expiresIn: '1h' }
          );
          console.log(token);
          console.log("222");
          // Send the JWT token as part of the response
          res.status(200).send({ message: 'Login successful', token, email_verified_at: user.email_verified_at });
        }
      } else {
        console.log('not logged');
        res.status(401).send({ message: 'Wrong email or password' });
      }
    });
  });


  app.post("/verify-code", async (req, res) => {
    const email = req.body.email;
    const verificationCode = req.body.verificationCode;
  
    con.query(
      "SELECT * FROM users WHERE email = ? AND verification_code = ?",
      [email, verificationCode],
      async (err, results) => {
        if (err) {
          console.error("Error querying the database: " + err);
          return res.status(500).send({ message: "Internal Server Error" });
        }
  
        if (results.length === 0) {
          console.log("Invalid verification code or email");
          return res.status(401).send({ message: "Invalid verification code or email" });
        }
  
        const user = results[0];
  
        // Update the email_verified_at column with the current timestamp
        con.query(
          "UPDATE users SET email_verified_at = CURRENT_TIMESTAMP() WHERE email = ?",
          [email],
          (updateErr, updateResult) => {
            if (updateErr) {
              console.error("Error updating email_verified_at: " + updateErr);
              return res.status(500).send({ message: "Internal Server Error" });
            }
  
            console.log("Email verified successfully");
            res.status(200).send({ message: "Email verified successfully" });
          }
        );
      }
    );
  });

  
  app.put('/update-profile', (req, res) => {
    const token = req.headers.authorization.split(' ')[1]; // Get the token from headers
  
    // Verify and decode the token to get the user's information
    jwt.verify(token, 'jktrxsw2005', (err, decoded) => {
      if (err) {
        console.log('JWT Verification Error:', err.message);
        return res.status(401).json({ error: 'Invalid token' });
      }
      console.log(decoded.userId);
      const userId = decoded.userId; // Access the user ID from the decoded token
      const { userName } = req.body;
  
      // Validate the incoming data (you can add more validation as needed)
      if (!userName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
  
      // Update the user's profile in the database
      const sql = 'UPDATE users SET name = ? WHERE id = ?';
      con.query(sql, [userName, userId], (err, result) => {
        if (err) {
          console.error('Error updating profile:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
  
        console.log('Profile updated successfully');
        return res.status(200).json({ message: 'Profile updated successfully' });
      });
    });
  });
  
  // Function to get user data by userId
  async function getUserById(userId) {
    return new Promise((resolve, reject) => {
      con.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) {
          reject(err);
        } else {
          // Assuming you expect a single user with this ID, return the first result
          resolve(results[0]);
        }
      });
    });
  }
  
  app.post('/change-password', extractUserId, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.userId;
  
    try {
      // Get the user's current data from the database
      const user = await getUserById(userId);
  
      // Check if the old password matches the stored password
      const passwordMatch = await bcrypt.compare(oldPassword, user.password);
  
      if (!passwordMatch) {
        return res.status(400).json({ message: 'Old password is incorrect' });
      }
  
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      // Update the user's password in the database
      con.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId],
        (err, results) => {
          if (err) {
            console.error('Error updating password:', err);
            return res.status(500).json({ message: 'Internal server error' });
          }
  
          res.status(200).json({ message: 'Password changed successfully' });
        }
      );
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  
  
  app.get('/SetProfile', (req, res) => {
    // Get the Authorization header from the request
    const authorizationHeader = req.headers.authorization;
  
    // Check if the header exists and starts with "Bearer "
    if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
      // Extract the token part by splitting the header string
      const token = authorizationHeader.split(' ')[1];
  
      // Verify the JWT token
      jwt.verify(token, 'jktrxsw2005', (err, decoded) => {
        if (err) {
          console.log('JWT Verification Error:', err.message);
          // Token verification failed, user is not authenticated
          return res.status(401).json({ message: 'Invalid token' });
        }
  
        // Token is valid, you can access the user's information in 'decoded'
        const userId = decoded.userId;
  
        // Now, fetch user data (name, email) from the database based on the userId
        const selectSql = 'SELECT name, email FROM users WHERE id = ?';
        con.query(selectSql, [userId], (selectErr, selectResult) => {
          if (selectErr) {
            console.error('Error fetching user data:', selectErr);
            return res.status(500).json({ error: 'Internal server error' });
          }
  
          const userData = selectResult[0]; // Assuming there is only one user with the given ID
  
          // Send the user's data to the client
          res.status(200).json(userData);
        });
      });
    } else {
      console.log('Bearer token not provided');
      // Bearer token is not provided in the header
      res.status(401).json({ message: 'Bearer token required' });
    }
  });

  // Middleware to extract userId from token
function extractUserId(req, res, next) {
    // Get the Authorization header from the request
    const authorizationHeader = req.headers.authorization;
  
    // Check if the header exists and starts with "Bearer "
    if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
      // Extract the token part by splitting the header string
      const token = authorizationHeader.split(' ')[1];
  
      // Verify the JWT token and extract userId
      jwt.verify(token, 'jktrxsw2005', (err, decoded) => {
        if (err) {
          console.log('JWT Verification Error:', err.message);
          // Token verification failed, return an error
          return res.status(401).json({ message: 'Invalid token' });
        }
  
        // Token is valid, and you can access the user's information in 'decoded'
        req.userId = decoded.userId; // Attach userId to the request object
        next(); // Continue to the next middleware or route handler
      });
    } else {
      console.log('Bearer token not provided');
      // Bearer token is not provided in the header
      res.status(401).json({ message: 'Bearer token required' });
    }
  }


  app.post('/AddNewVideo', extractUserId, async (req, res) => {
    const name = req.body.name;
    const description = req.body.description;
    const url = req.body.url;
    const genre = req.body.genre;

    const userId = req.userId;

    console.log("Request received at /add");
    console.log(userId);
    try {

      con.query(
        "INSERT INTO videos (name, genre, description, url, UserWhoUploadId) VALUES (?, ?, ?, ?, ?)",
        [name, genre, description, url, userId],
        (err, result) => {
          if (result) {
            res.send(result);
          } else {
            res.send({ message: "ENTER CORRECT ASKED DETAILS!" });
          }
        }
      );
    } catch (err) {
      console.error("Error registering user: " + err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  });


  // Route to get the latest 100 videos
app.get('/getLatestVideos', (req, res) => {

  // Fetch the latest 100 videos from the database
  con.query(
      'SELECT * FROM videos ORDER BY upload_date DESC LIMIT 100',
      (err, results) => {
          if (err) {
              console.error('Error fetching latest videos:', err);
              return res.status(500).json({ message: 'Internal Server Error' });
          }

          // Send the fetched videos as JSON response
          res.json(results);
      }
  );
});


// Route to get all genres from the database
app.get('/getGenres', (req, res) => {
  con.query(
      'SELECT DISTINCT genre FROM videos',
      (err, results) => {
          if (err) {
              console.error('Error fetching genres:', err);
              return res.status(500).json({ message: 'Internal Server Error' });
          }

          const genres = results.map(row => row.genre);
          res.json(genres);
      }
  );
});

// Route to get the latest 100 videos with a specific genre
app.get('/getVideosByGenre', (req, res) => {
  const genre = req.query.genre;

  con.query(
      'SELECT * FROM videos WHERE genre = ? ORDER BY upload_date DESC LIMIT 100',
      [genre],
      (err, results) => {
          if (err) {
              console.error('Error fetching videos by genre:', err);
              return res.status(500).json({ message: 'Internal Server Error' });
          }

          res.json(results);
      }
  );
});


app.get('/getVideosByTimeRange', (req, res) => {
  const { timeRange } = req.query;

  let startDate = new Date();
  switch (timeRange) {
      case 'last24hours':
          startDate.setDate(startDate.getDate() - 1);
          break;
      case 'lastweek':
          startDate.setDate(startDate.getDate() - 7);
          break;
      case 'lastmonth':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      case 'lastyear':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      default:
          break;
  }

  con.query('SELECT * FROM videos WHERE upload_date >= ? ORDER BY upload_date DESC LIMIT 100', [startDate], (err, results) => {
      if (err) {
          console.error('Error fetching videos:', err);
          return res.status(500).json({ message: 'Internal Server Error' });
      }
      res.json(results);
  });
});


app.get('/getVideosByName', (req, res) => {
  const { name } = req.query;

  con.query('SELECT * FROM videos WHERE name LIKE ? LIMIT 100', [`%${name}%`], (err, results) => {
      if (err) {
          console.error('Error fetching videos by name:', err);
          return res.status(500).json({ message: 'Internal Server Error' });
      }
      res.json(results);
  });
});



app.get('/search-genre', (req, res) => {
  const query = req.query.query;
  let sql = 'SELECT * FROM genres_list';

  if (query) {
    // If there's a search query, filter the results
    sql += ` WHERE genre LIKE '%${query}%'`;
  }

  // Query the database
  con.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    
    // If no search query is provided, fetch all data
    if (!query) {
      con.query('SELECT * FROM genres_list', (err, allResults) => {
        if (err) {
          console.error('Error executing MySQL query:', err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        
        res.json({ results: allResults });
      });
    } else {
      res.json({ results });
    }
  });
});


app.get('/search-author', (req, res) => {
  const query = req.query.query;
  let sql = 'SELECT * FROM authors_list';

  if (query) {
    // If there's a search query, filter the results
    sql += ` WHERE author LIKE '%${query}%'`;
  }

  // Query the database
  con.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    
    // If no search query is provided, fetch all data
    if (!query) {
      con.query('SELECT * FROM authors_list', (err, allResults) => {
        if (err) {
          console.error('Error executing MySQL query:', err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        
        res.json({ results: allResults });
      });
    } else {
      res.json({ results });
    }
  });
});

app.get('/search-publisher', (req, res) => {
  const query = req.query.query;
  let sql = 'SELECT * FROM publishers_list';

  if (query) {
    // If there's a search query, filter the results
    sql += ` WHERE publisher LIKE '%${query}%'`;
  }

  // Query the database
  con.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    
    // If no search query is provided, fetch all data
    if (!query) {
      con.query('SELECT * FROM publishers_list', (err, allResults) => {
        if (err) {
          console.error('Error executing MySQL query:', err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        
        res.json({ results: allResults });
      });
    } else {
      res.json({ results });
    }
  });
});

app.get('/search-team', (req, res) => {
  const query = req.query.query;
  let sql = 'SELECT * FROM teams_list';

  if (query) {
    // If there's a search query, filter the results
    sql += ` WHERE team_name LIKE '%${query}%'`;
  }

  // Query the database
  con.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    
    // If no search query is provided, fetch all data
    if (!query) {
      con.query('SELECT * FROM teams_list', (err, allResults) => {
        if (err) {
          console.error('Error executing MySQL query:', err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        
        res.json({ results: allResults });
      });
    } else {
      res.json({ results });
    }
  });
});


app.get('/image/:id', (req, res) => {
  const imageId = req.params.id;
  
  // Retrieve image from database based on imageId
  // Your database retrieval code here

  // Assuming imageData is the base64 encoded string retrieved from the database
  res.send(imageData);
});


// Multer storage setup: storing files in memory as Buffer objects
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, 'uploads/') // Destination folder
  },
  filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname) // File naming
  }
});

const upload = multer({ storage: storage });


app.post('/AddNewBook', upload.single('image'), extractUserId, function (req, res, next) {
  const userId = req.userId;
 console.log("----------------------------------");
  const {
      titleUkr,
      titleEng,
      originalTitle,
      status,
      publicationYear,
      pagesCount,
      ageRestriction,
      translationStatus,
      downloadOption,
      description,
      genres,
      authors,
      publishers,
      teams,
  } = req.body;
  
  const imageBuffer = fs.readFileSync(req.file.path);
  const image = imageBuffer.toString('base64');

  // Insert the new book into the database
  const sql = `INSERT INTO books 
             (name_ukr, name_eng, name_original, book_cover, book_status, year_of_release, pages_count, age_restriction, translation_status, downloading_pages, description, user_who_add) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  con.query(
      sql,
      [
          titleUkr,
          titleEng,
          originalTitle,
          image,
          status,
          publicationYear,
          pagesCount,
          ageRestriction,
          translationStatus,
          downloadOption,
          description,
          userId,
      ],
          (err, result) => {
          if (err) {
              console.error('Error executing MySQL query:', err);
              res.status(500).json({ error: 'Internal server error' });
              return;
          }

          const sql2 = `SELECT idbooks
          FROM books
          WHERE name_ukr = ?`;

          con.query(sql2, [titleUkr], (err, result) => {
          if (err) {
          console.error('Error executing MySQL query:', err);
          res.status(500).json({ error: 'Internal server error' });
          return;
          }

          if (result.length === 0) {
          res.status(404).json({ error: 'Book not found' });
          return;
          }

                  const bookId = result[0].idbooks;

                  // Check if genres is not provided or not an array
                  if (!genres || !Array.isArray(genres)) {
                      res.status(400).json({ error: 'Genres must be provided as an array' });
                      console.log("Genres must be provided as an array");
                      return;
                  }

                  // Construct the SQL query for inserting genres
                  const sql3 = `INSERT INTO genres (genre, book_id_g) VALUES ?`;

                  // Prepare the values for the query
                  const genreValues = genres.map(genre => [genre, bookId]);

                  // Execute the SQL query to insert genres
                  con.query(sql3, [genreValues], (err, result) => {
                      if (err) {
                          console.error('Error executing MySQL query:', err);
                          res.status(500).json({ error: 'Internal server error' });
                          return;
                  }



                        // Check if genres is not provided or not an array
                        if (!authors || !Array.isArray(authors)) {
                            res.status(400).json({ error: 'authors must be provided as an array' });
                            console.log("authors must be provided as an array");
                            return;
                        }

                        // Construct the SQL query for inserting genres
                        const sql4 = `INSERT INTO authors (author, book_id_a) VALUES ?`;

                        // Prepare the values for the query
                        const authorValues  = authors.map(author => [author, bookId]);

                        // Execute the SQL query to insert genres
                        con.query(sql4, [authorValues], (err, result) => {
                            if (err) {
                                console.error('Error executing MySQL query:', err);
                                res.status(500).json({ error: 'Internal server error' });
                                return;
                        }
                       



                        // Check if genres is not provided or not an array
                        if (!publishers || !Array.isArray(publishers)) {
                            res.status(400).json({ error: 'publishers must be provided as an array' });
                            console.log("publishers must be provided as an array");
                            return;
                        }

                        // Construct the SQL query for inserting genres
                        const sql5 = `INSERT INTO publishers (publisher, book_id_p) VALUES ?`;

                        // Prepare the values for the query
                        const publisherValues  = publishers.map(publisher => [publisher, bookId]);

                        // Execute the SQL query to insert genres
                        con.query(sql5, [publisherValues], (err, result) => {
                            if (err) {
                                console.error('Error executing MySQL query:', err);
                                res.status(500).json({ error: 'Internal server error' });
                                return;
                        }

                        
                        // Check if genres is not provided or not an array
                        if (!teams || !Array.isArray(teams)) {
                          res.status(400).json({ error: 'teams must be provided as an array' });
                          console.log("teams must be provided as an array");
                          return;
                      }

                      const sql7 = 'SELECT idteams_list FROM teams_list WHERE team_name = ?';
                      con.query(sql7, [teams], (err, results) => {
                          if (err) {
                              console.error('Error executing MySQL query:', err);
                              res.status(500).json({ error: 'Internal server error' });
                              return;
                          }
                          if (results.length === 0) {
                              res.status(404).json({ error: 'Book not found' });
                              return;
                          }
                          const idteams_list = results[0].idteams_list;
                          console.log("idTeam: "+idteams_list);

                          
                        const sql6 = `INSERT INTO teams (book_id_t, team_id) VALUES (?, ?)`;
                        
                        // Execute the SQL query to insert genres
                        con.query(sql6, [bookId, idteams_list], (err, result) => {
                            if (err) {
                                console.error('Error executing MySQL query:', err);
                                res.status(500).json({ error: 'Internal server error' });
                                return;
                        }


                        res.status(201).json({ message: 'Book and genres added successfully', bookId: bookId });
                      });





                        
                });     
              });      
            });
          });
        });
      }
  );
});



app.post('/AddNewAuthor', upload.none(), extractUserId, async (req, res) => {

  const { EngName, UkrName } = req.body;
  const userId = req.userId;

  try {

    con.query(
      "INSERT INTO authors_list (author, author_eng, user_who_add) VALUES (?, ?, ?)",
      [UkrName, EngName, userId],
      (err, result) => {
        if (result) {
          res.send(result);
        } else {
          res.send({ message: "ENTER CORRECT ASKED DETAILS!" });
        }
      }
    );
  } catch (err) {
    console.error("Error registering user: " + err);
    res.status(500).send({ message: "Internal Server Error" });
  }
});


app.post('/AddNewPublisher', upload.none(), extractUserId, async (req, res) => {

  const { Name } = req.body;
  const userId = req.userId;

  try {

    con.query(
      "INSERT INTO publishers_list (publisher, user_who_add) VALUES (?, ?)",
      [Name, userId],
      (err, result) => {
        if (result) {
          res.send(result);
        } else {
          res.send({ message: "ENTER CORRECT ASKED DETAILS!" });
        }
      }
    );
  } catch (err) {
    console.error("Error registering user: " + err);
    res.status(500).send({ message: "Internal Server Error" });
  }
});


app.post('/AddNewTeam', upload.single('image'), extractUserId, async (req, res) => {

  const {Name, Telegram, Discord, Description } = req.body;
  const userId = req.userId;
  const imageBuffer = fs.readFileSync(req.file.path);
  const image = imageBuffer.toString('base64');

  try {

    con.query(
      "INSERT INTO teams_list (team_name, team_cover, telegram, discord, description, user_who_add) VALUES (?, ?, ?, ?, ?, ?)",
      [Name, image, Telegram, Discord, Description, userId],
      (err, result) => {
        if (result) {
          res.send(result);
        } else {
          res.send({ message: "ENTER CORRECT ASKED DETAILS!" });
        }
      }
    );
  } catch (err) {
    console.error("Error registering user: " + err);
    res.status(500).send({ message: "Internal Server Error" });
  }
});


app.get('/books', (req, res) => {
  const sql = 'SELECT idbooks, name_ukr, TO_BASE64(book_cover) AS book_cover FROM books';
  con.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    res.json(results);
  });
});

// Endpoint to fetch a specific book by its ID
app.get('/books/:id', (req, res) => {
  const bookId = req.params.id;
  const sql = 'SELECT name_ukr, name_eng, name_original, TO_BASE64(book_cover) AS book_cover, book_status, year_of_release, pages_count, age_restriction, translation_status, downloading_pages, description, user_who_add FROM books WHERE idbooks = ?';
  con.query(sql, [bookId], (err, results) => {
      if (err) {
          console.error('Error executing MySQL query:', err);
          res.status(500).json({ error: 'Internal server error' });
          return;
      }
      if (results.length === 0) {
          res.status(404).json({ error: 'Book not found' });
          return;
      }
      res.json(results[0]);
  });
});


app.get('/books-author/:id', (req, res) => {
  const bookId = req.params.id;
  const sql = 'SELECT author FROM authors WHERE book_id_a = ?';
  con.query(sql, [bookId], (err, results) => {
      if (err) {
          console.error('Error executing MySQL query:', err);
          res.status(500).json({ error: 'Internal server error' });
          return;
      }
      if (results.length === 0) {
          res.status(404).json({ error: 'Book not found' });
          return;
      }
      res.json(results[0]);
  });
});

app.get('/books-publisher/:id', (req, res) => {
  const bookId = req.params.id;
  const sql = 'SELECT publisher FROM publishers WHERE book_id_p = ?';
  con.query(sql, [bookId], (err, results) => {
      if (err) {
          console.error('Error executing MySQL query:', err);
          res.status(500).json({ error: 'Internal server error' });
          return;
      }
      if (results.length === 0) {
          res.status(404).json({ error: 'Book not found' });
          return;
      }
      res.json(results[0]);
  });
});

app.get('/books-genre/:id', (req, res) => {
  const bookId = req.params.id;
  const sql = 'SELECT genre FROM genres WHERE book_id_g = ?';
  con.query(sql, [bookId], (err, results) => {
      if (err) {
          console.error('Error executing MySQL query:', err);
          res.status(500).json({ error: 'Internal server error' });
          return;
      }
      if (results.length === 0) {
          res.status(404).json({ error: 'Book not found' });
          return;
      }
      const genres = results.map(result => result.genre);
      res.json(genres);
  });
});


app.get('/books-team/:id', (req, res) => {
  const bookId = req.params.id;
  const sql = 'SELECT team_id FROM teams WHERE book_id_t = ?';
  con.query(sql, [bookId], (err, results) => {
      if (err) {
          console.error('Error executing MySQL query:', err);
          res.status(500).json({ error: 'Internal server error' });
          return;
      }
      if (results.length === 0) {
          res.status(404).json({ error: 'Book not found' });
          return;
      }
      const team_id = results[0].team_id;
      const sql2 = 'SELECT team_name, TO_BASE64(team_cover) AS team_cover FROM teams_list WHERE idteams_list = ?';
      con.query(sql2, [team_id], (err, results) => {
          if (err) {
              console.error('Error executing MySQL query:', err);
              res.status(500).json({ error: 'Internal server error' });
              return;
          }
          if (results.length === 0) {
              res.status(404).json({ error: 'Book not found' });
              return;
          }
          const teams = results.map(result => ({
            team_name: result.team_name,
            team_cover: result.team_cover
          }));

          res.json(teams);


        });
  });
});





const epubStorage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, 'epub/'); // Directory where EPUB files will be stored
  },
  filename: (req, file, cb) => {
      const bookId = req.params.id;
      console.log("1: "+bookId);

      cb(null, `${bookId}---${Date.now()}---${file.originalname}`);
  },
});

const uploadEpub = multer({ storage: epubStorage });


// Endpoint to handle EPUB upload
app.post('/upload-epub/:id', uploadEpub.single('epubFile'), (req, res) => {
  const bookId = req.params.id;
  console.log("2: "+bookId);
  try {
      res.status(200).json({ message: 'EPUB file uploaded successfully', filename: req.file.filename });
  } catch (error) {
      res.status(500).json({ error: 'Failed to upload EPUB file' });
  }
});



// Endpoint to fetch book details by ID
app.get('/BookData/:id', (req, res) => {
  const bookId = req.params.id;
  console.log(bookId);
  const sql = 'SELECT * FROM books WHERE idbooks = ?';
  con.query(sql, [bookId], (err, results) => {
      if (err) {
          console.error('Error executing MySQL query:', err);
          res.status(500).json({ error: 'Internal server error' });
          return;
      }
      if (results.length === 0) {
          res.status(404).json({ error: 'Book not found' });
          return;
      }
      res.json(results[0]);
  });
});



app.get('/epub/:id', (req, res) => {
  const bookId = req.params.id;
  console.log(bookId)
  const dirPath = path.join(__dirname, 'epub');
  const fs = require('fs');

  fs.readdir(dirPath, (err, files) => {
      if (err) {
          console.error('Error reading directory:', err);
          return res.status(500).send('Internal Server Error');
      }

      const epubFile = files.find(file => file.startsWith(bookId));
      if (!epubFile) {
          return res.status(404).send('File not found');
      }

      const filePath = path.join(dirPath, epubFile);
      console.log('Sending file:', filePath); // Log the file being sent
      res.sendFile(filePath);
  });
});

app.get('/epub-exists/:id', (req, res) => {
  const bookId = req.params.id;
  const dirPath = path.join(__dirname, 'epub');

  fs.readdir(dirPath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return res.status(500).send('Internal Server Error');
    }

    const epubFile = files.find(file => file.startsWith(bookId));
    if (!epubFile) {
      return res.status(404).send('File not found');
    }

    res.status(200).send('File exists');
  });
});


/*
app.get('/latest-books', async (req, res) => {
  try {
    // Query to fetch the latest books sorted by the datetime column
    const query = `
      SELECT id, title, cover_image_url, datetime_column
      FROM books
      ORDER BY datetime_column DESC
      LIMIT 5;  -- Adjust the limit as needed
    `;
    
    // Execute the query
    const [latestBooks] = con.query(query);

    // Send the response with the latest books
    res.json(latestBooks);
  } catch (error) {
    console.error('Error fetching latest books:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
*/


app.get('/latest-books', (req, res) => {
  const sql = 'SELECT idbooks, name_ukr, datetime, TO_BASE64(book_cover) AS book_cover FROM books ORDER BY datetime DESC LIMIT 15';
  con.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    res.json(results);
  });
});


app.listen(3001, () => {
    console.log("running on port 3001");
})
    
