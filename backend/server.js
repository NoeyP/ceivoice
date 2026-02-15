const connection = mysql.createConnection({
  host: 'db',
  port: 3306, // Use 3306 here because it's container-to-container
  user: 'support_user',
  password: 'support_password',
  database: 'ceivoice'
});