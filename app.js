const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const app = express();
const port = 3000;
const path = require('path');
const config = require('./config'); 
const odbc = require('odbc');
const { parse, format, isValid } = require('date-fns');
const { start } = require('repl');

app.set('views', './views'); // Set the views directory if not in the root
app.get('/dashboard', (req, res) => {
  res.render('dashboard'); // Render the 'about.ejs' view
});

app.set('view engine', 'ejs');
app.use(express.static('public'));

const useWindowsAuth = true; // Set to true to use Windows Auth, false for SQL Login

// --- Build Connection String ---
let connectionString = `Driver={${config.sqlconn.driverName}};Server=${config.sqlconn.server};Database=${config.sqlconn.database};`;

if (useWindowsAuth) {
  connectionString += 'Trusted_Connection=yes;'; // Standard ODBC parameter for Windows Auth
  console.log("Using Windows Authentication.");
} else {
  connectionString += `Uid=${sqlLogin.uid};Pwd=${sqlLogin.pwd};`;
  console.log(`Using SQL Server Authentication for user: ${sqlLogin.uid}`);
}

async function executeOdbcQueryWithParams(sqlQuery, params = []) {
  console.log(`Executing ODBC query: ${sqlQuery.substring(0, 150)}...`);
  if (params.length > 0) {
      console.log('With parameters:', params);
  }

  let connection; // Scope connection for finally block

  try {
      // Connect to the database
      connection = await odbc.connect(connectionString);
      console.log("ODBC connection successful.");

      // Execute the query with parameters
      // The 'odbc' library expects parameters as an array for '?' placeholders
      const result = await connection.query(sqlQuery, params);
      console.log(`ODBC query executed successfully. Rows returned: ${result.length}`);

      // The 'odbc' library's query result usually includes metadata.
      // The actual row data is often directly in the array.
      // You might inspect `result.columns` or `result.count` if needed.
      return result; // Return the array of row objects (or potentially with metadata)

  } catch (error) {
      console.error('ODBC Error:', error);
      return null; // Indicate failure

  } finally {
      // Ensure the connection is closed
      if (connection) {
          try {
              await connection.close();
              console.log("ODBC connection closed.");
          } catch (closeError) {
              console.error('Error closing ODBC connection:', closeError);
          }
      }
  }
}



async function importData() {
    console.log("\n--- ODBC Example 1: Select Orders by Customer ID and Status ---");
    // Use '?' for placeholders
    const accountQuery = `
        
        SELECT AF.FilePath, U.UserId, A.AccountId,A.AccountType,InstitutionName
        FROM dbo.AccountFiles AF
        INNER JOIN dbo.accounts A
        ON AF.AccountId = A.AccountId
        INNER JOIN UserAccounts UA
        ON UA.AccountId = A.AccountId
        INNER JOIN Users U
        ON U.UserId = UA.UserId
        WHERE A.IsActive = 1

    `;
    // Parameters must be in an array, matching the order of '?'
    const accountParams = [
        //1   // IsActive
    ];
    const account = await executeOdbcQueryWithParams(accountQuery, accountParams);

    if (account) {
        if (account.length > 0) {
            console.log("Accounts Found:");
            //console.table(account); // Display results        
            
            for (let i = 0; i < account.length; i++) {
              console.log(i);
              readAccountFileTransactions(account[i])
            }
        } else {
            console.log("No account found matching the criteria.");
        }
         // Example: Accessing a specific field from the first row
         // if(orders.length > 0) { console.log("First Order ID:", orders[0].OrderID); }
    } else {
        console.log("Account query failed.");
    }
    
}



let dateFilterDict = {
  "Last 30 days": "last30Days"
  ,"Last 3 Months": "last3Months"
  ,"Last 6 Months": "last6Months"
  ,"YTD": "ytd"
  ,"Last Year": "lastYear"
  ,"Last 2 Years": "last2Years"
};

let monthYearFilterDict;

let checkingData = [];
let savingsData = [];
let spendingData = {};
let spendingData0 = {};

//sample data
const data_files = config.data_files
const Users = config.Users

let AccountData = [];
let Categories = [];

async function loadCashCompass() {
  await getAccountTransactions(Users[0])
  await getAccountTransactions(Users[1])
  await getCategories()
  

  // spendingData = AccountData
  console.log(AccountData); 
  console.log(Categories); 

  if (AccountData.length > 0) {
    monthYearFilterDict = processDates(AccountData[1].Transactions);
    Object.entries(monthYearFilterDict).forEach(([key, value]) => {
      dateFilterDict[key] = value;
    
    });
  }

}

loadCashCompass();

async function getCategories() {
  console.log("\n--- SELECT * FROM Transactions where AccountId = AccountId ---");
  // Use '?' for placeholders
  const query = `
  
  SELECT DISTINCT Category 
  FROM Transactions t
  INNER JOIN UserAccounts ua
  on ua.AccountId = t.AccountId
  INNER JOIN Users u
  ON u.UserId = ua.UserId
  AND U.UserId in (?,?)
  WHERE transactiontype not in ('income','transfer','payment') 
  order by Category
  `;
  // Parameters must be in an array, matching the order of '?'
  const params = [
    Users[0] //userid 1
    ,Users[1] //userid 2
  ];
  const categories = await executeOdbcQueryWithParams(query, params);

  if (categories) {
      if (categories.length > 0) {
        
          console.log("Categories Found:");
          //console.table(accountTransactions); // Display results        
          
          for (let i = 0; i < categories.length; i++) {
            console.log(categories[i].Category);
            Categories.push(categories[i].Category);
          }
      } else {
          console.log("No categories found matching the criteria.");
      }
       // Example: Accessing a specific field from the first row
       // if(orders.length > 0) { console.log("First Order ID:", orders[0].OrderID); }
  } else {
      console.log("categories query failed.");
  }
  
}

async function getAccountTransactions(AccountId) {
  console.log("\n--- SELECT * FROM Transactions where AccountId = AccountId ---");
  // Use '?' for placeholders
  const accountTransactionsQuery = `SELECT 
        t.AccountId
        ,t.Category
        ,t.TransactionType
        ,t.TransactionDate
        ,t.Amount
        ,t.Description
        ,t.DPUID
        ,a.AccountType
        ,Memo = ISNULL(t.Memo,'')
      FROM dbo.Transactions t
      INNER JOIN dbo.Accounts a
      ON t.AccountId = a.AccountId
	  INNER JOIN UserAccounts UA
	  ON UA.AccountId = t.AccountId	
	  INNER JOIN Users u
	  on u.UserId = UA.UserId
      WHERE u.UserId = ?
      AND t.TransactionType NOT IN ('Payment','Income','Transfer')
      `;
  // Parameters must be in an array, matching the order of '?'
  const accountTransactionsParams = [
    AccountId   // AccountId
  ];
  const accountTransactions = await executeOdbcQueryWithParams(accountTransactionsQuery, accountTransactionsParams);

  if (accountTransactions) {
      if (accountTransactions.length > 0) {
        let myAccountDict = {}
        myAccountDict["AccountId"] = AccountId; // Sets the value for the key "key"
        myAccountDict["Transactions"] = accountTransactions; // Sets the value for the key "key"

          console.log("Accounts Found:");
          //console.table(accountTransactions); // Display results        
          
          AccountData.push(myAccountDict)
          // for (let i = 0; i < accountTransactions.length; i++) {
          //   console.log(i);
          // }
      } else {
          console.log("No account transactions found matching the criteria.");
      }
       // Example: Accessing a specific field from the first row
       // if(orders.length > 0) { console.log("First Order ID:", orders[0].OrderID); }
  } else {
      console.log("account transactions query failed.");
  }
  
}




async function executeInsertTransaction(transaction,account) {
const accountType = account.accountType
const InstitutionName = account.InstitutionName
let  mergeTransactionQuery = 
      `MERGE dbo.Transactions T
      USING (SELECT 

        AccountId				    =?
        ,Category				    =?
        ,TransactionDate		=?
        ,Amount					    =?
        ,Description			  =?
        ,TransactionType		=?
        ,IsCleared				  =?
        ,ClearedDate			  =?
        ,DPUID					    =?
      ) S 
      ON S.DPUID = T.DPUID
      WHEN NOT MATCHED THEN 
      INSERT (	AccountId		
                ,Category		
                ,TransactionDate	
                ,Amount			
                ,Description		
                ,TransactionType	
                ,IsCleared		
                ,ClearedDate		
                ,DPUID			
            )				
          VALUES
                (S.AccountId		
                ,S.Category		
                ,S.TransactionDate	
                ,S.Amount			
                ,S.Description		
            ,S.TransactionType	
            ,S.IsCleared		
            ,S.ClearedDate		
            ,S.DPUID);`

let formattedTransactionDate = ''
let formattedPostDate = ''
let values = []
let category = transaction.Category
let amount = 0.00
let description = transaction.Description
let transactionType = transaction.Type

if (InstitutionName == 'Wells Fargo') {
  formattedTransactionDate = formatDateMDYtoYMD_datefns(transaction.TransactionDate)
  formattedPostDate = formattedTransactionDate
  category = ''
  transactionType = ''
  amount = transaction.Amount
  //TransactionDate,Amount,,,Description
}
if (InstitutionName == 'Charles Schwab') {
  formattedTransactionDate = formatDateMDYtoYMD_datefns(transaction.Date)
  formattedPostDate = formattedTransactionDate
  category = ''
  transactionType = transaction.Type
  if (transaction.Deposit) {
    amount = amount = parseFloat( transaction.Deposit.replace('$', '').replace(',',''))
  }
  if (transaction.Withdrawal) {
    amount = parseFloat( transaction.Withdrawal.replace('$', '').replace(',',''))*-1
  }

  //"Date","Status","Type","CheckNumber","Description","Withdrawal","Deposit","RunningBalance"
}
if (InstitutionName == 'JP Morgan Chase Bank') {
  formattedTransactionDate = formatDateMDYtoYMD_datefns(transaction.TransactionDate)
  formattedPostDate = formattedTransactionDate
  amount = transaction.Amount
}

if (InstitutionName == 'Credit Card Bank')
{
  formattedTransactionDate = transaction.TransactionDate
  formattedPostDate = formattedTransactionDate
  amount = transaction.Amount

}
  console.log("\n--- ODBC Example 3: INSERT statement ---");
   // IMPORTANT: Always use parameters for INSERT/UPDATE/DELETE
  // Note: Replace YourLogTable, LogLevel, Message with actual names
 
  values = [account.AccountId
    ,category
    ,formattedTransactionDate
    ,amount
    ,description
    ,transactionType
    ,1
    ,formattedPostDate
  ];

  let dpuid = values.join("|"); // '1|Groceries|2025-03-31|-4.84|VONS #2116|Sale|1|2025-04-02'

  const mergeTransactionParams =  [account.AccountId
    ,category
    ,formattedTransactionDate
    ,amount
    ,description
    ,transactionType
    ,1
    ,formattedPostDate
    ,dpuid
  ];
  
  // Execute the insert. The return value might be just metadata or an empty array.
  const mergeResult = await executeOdbcQueryWithParams(mergeTransactionQuery, mergeTransactionParams);

   if (mergeResult !== null) { // Check if the operation didn't fail outright
      console.log("INSERT operation submitted successfully via ODBC.");
      // The 'odbc' library might not return affected row count directly in the main result.
      // You might need to check result properties or run a subsequent SELECT COUNT(*) if needed.
      // console.log("Insert Result details:", mergeResult);
  } else {
      console.log("INSERT Query failed via ODBC.");
  }
}


function readAccountFileTransactions(account)
{
  
  const filePath = account.FilePath //'data/Chase5577_Activity20250101_20250406_20250406.CSV'; // --- Replace with the actual path to your CSV file ---
  const results = [];

  // Check if the file exists before trying to read it
  if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found at path: ${filePath}`);
      process.exit(1); // Exit the script with an error code
  }

  fs.createReadStream(filePath)
      .pipe(csv()) // Pipe the read stream into the csv-parser
      .on('data', (data) => {
          // This event is triggered for each row parsed from the CSV
          // 'data' will be an object with keys corresponding to the CSV headers
          results.push(data);
      })
      .on('end', () => {
          // This event is triggered when the entire file has been read and parsed
          console.log('CSV file successfully processed.');
          console.log('---------------------------------');
          console.log('Parsed Data:', results);
          console.log('---------------------------------');
          // You can now work with the 'results' array, which contains
          // an object for each row (excluding the header row).
          // Example: Access the first row's 'Name' property (assuming a 'Name' header)
          if (results.length > 0) {
            // console.log('First Row [TransactionDate]:', results[0].TransactionDate); 
            // console.log('First Row [Description]:', results[0].Description); 
            // console.log('First Row [Category]:', results[0].Category); 

            for (let i = 0; i < Object.keys(results).length; i++) {
              executeInsertTransaction(results[i],account)
            }
          }
      })
      .on('error', (error) => {
          // This event catches errors during the reading or parsing process
          console.error('Error reading or parsing CSV file:', error.message);
      });

  console.log(`Attempting to read CSV file from: ${filePath}`);
}

function processDates(inputDictionary) {
 
  const monthYearMap = {}; // Store unique month/year with first day
  const processedDates = []; // Array to store the dates in YYYYMMdd format
  
  for (const key in inputDictionary) {
    if (inputDictionary.hasOwnProperty(key)) {

      try {

      const dateStr = inputDictionary[key].TransactionDate;

      // Convert to Date object
      const date = new Date(dateStr);
      if (isNaN(date)) {
         //console.error(`Invalid date string: ${dateStr}`)
         continue; // skip to next entry
      }
      const year = date.getFullYear();
      const monthName = getMonthName(date.getMonth());
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed

      const monthYearKey = `${monthName} ${year}`;

      if (!monthYearMap[monthYearKey]) {
           // Create date for first of month
        const firstDayOfMonth = new Date(year, date.getMonth(), 1); 
        const firstDayYYYYMMDD = `${year}${month}01`
        monthYearMap[monthYearKey] = firstDayYYYYMMDD;
        processedDates.push(firstDayYYYYMMDD); // for sorting

       }
      } catch (error) {
        //console.error("An error occurred:", error.message);
      }
    }
  }

   // create dictionary to return, with Month Year as key and value from sorted list
   const result = {};
   for (const monthYearKey in monthYearMap) {
       if (monthYearMap.hasOwnProperty(monthYearKey)) {
            for (const formattedDate of processedDates) {
              const datePart = formattedDate.substring(0,6);
              const keyPart = formatDateToYYYYMM(new Date(monthYearKey))//monthYearKey.substring(0,2)+monthYearKey.substring(3,7);
              if (datePart == keyPart){
                result[monthYearKey] = formattedDate;
              }
              
           }
      }
   }
  
  return sortDictionaryByValueDesc(result);
}

function getMonthName(monthNumber, locale = 'default') {
  const date = new Date(2000, monthNumber); // Year is irrelevant
  return date.toLocaleString(locale, { month: 'long' });
}

function formatDateToYYYYMM(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Add 1 because months are 0-indexed

  return `${year}${month}`;
}

function sortDictionaryByValueDesc(inputDictionary) {
  // 1. Convert the dictionary to an array of [key, value] pairs.
  const entries = Object.entries(inputDictionary);

  // 2. Sort the array by value (in YYYYMMDD format), descending.
  entries.sort(([, valueA], [, valueB]) => {
      return valueB.localeCompare(valueA);
  });

  // 3. Convert the sorted array back into a dictionary (object)
  const sortedDictionary = {};
  for (const [key, value] of entries) {
      sortedDictionary[key] = value;
  }

  return sortedDictionary;
}



/**
 * Converts a date string from MM/DD/YYYY format to YYYY-MM-DD format using date-fns.
 *
 * @param {string} dateStringMDY - The date string in MM/DD/YYYY format (e.g., "12/31/2023").
 * @returns {string|null} The formatted date string in YYYY-MM-DD format (e.g., "2023-12-31"),
 *                        or null if the input is invalid.
 */
function formatDateMDYtoYMD_datefns(dateStringMDY) {
  if (!dateStringMDY || typeof dateStringMDY !== 'string') {
    console.error("Input must be a non-empty string.");
    return null;
  }

  // Define the format of the *input* string
  // See date-fns documentation for format specifiers:
  // MM = month (01-12), dd = day (01-31), yyyy = year
  const inputFormat = 'MM/dd/yyyy';

  try {
    // Parse the string into a Date object based on the expected input format
    // The third argument (new Date()) is a required reference date for parsing.
    const parsedDate = parse(dateStringMDY, inputFormat, new Date());

    // Check if parsing resulted in a valid date
    if (!isValid(parsedDate)) {
      console.error(`Invalid date string format or value: "${dateStringMDY}". Expected ${inputFormat}.`);
      return null;
    }

    // Define the desired *output* format
    // yyyy = year, MM = month (01-12), dd = day (01-31)
    const outputFormat = 'yyyy-MM-dd';

    // Format the Date object into the desired output string format
    return format(parsedDate, outputFormat);

  } catch (error) {
    console.error(`Error processing date string "${dateStringMDY}":`, error);
    return null;
  }
}

const spenderLabelData = require('./data/'+ data_files.spender_labels);
const targetData = require('./data/'+ data_files.target);

const cleanup_category = fs.readFileSync('data/'+data_files.cleanup_category, {encoding:'utf8'});
const dict_cleanup_category = csvToDict(cleanup_category);

function monthDiff(d1, d2) {
  var months;
  months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
}

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}
function csvToDict(csvData) {
  let linedelimiter = '\n'
  if (csvData.includes('\r\n')) {
    linedelimiter = '\r\n'
  }

  const lines = csvData.split(linedelimiter);
  const headers = lines[0].split(',');
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const dictRow = {};

    // const category = row.Category;
    // const amount = parseFloat(row.Amount);
    // const date = row.Date; //Or any other relevant data point.

    for (let j = 0; j < headers.length; j++) {
      dictRow[headers[j]] = row[j];
    }

    result.push(dictRow);
  }

  return result;
}

function processSpendingCategoryData(dict) {
  const numRecords = Object.keys(dict).length;
  const spendingData = {};
  const paymentData = {};
  let category ="";
  let typeValue = "";
  let itemDescription ="";
  //console.log(numRecords)
  let dateValue;

    for (let i = 0; i < Object.keys(dict).length; i++) {
      Object.entries(dict[i]).forEach(([key, value]) => {
      //  console.log("key: " + key)
      //  console.log("value: " + value);
      if (key == 'Category'){
        category = value
      }
      if (key == 'Amount'){
        categoryValue = value
      }
      if (key == 'TransactionDate'){
        dateValue = value
      }
      if (key == 'Type'){
        typeValue = value
      }
    });

    if (typeValue == "" && categoryValue > 0) {
    }
    
    if (typeValue == "Income") {
    };

    if (!spendingData[category] && typeValue != "Payment" && category != "Income" && category != "Way2Save"  && category != "Credit Card Payment" ) {
      spendingData[category]  = { total: 0, items: [] };
    }
    if (typeValue != "Payment" && category != "Income" && category != "Way2Save" && category != "Credit Card Payment" ) {
      spendingData[category].total += categoryValue*-1;
      spendingData[category].items.push(dict[i]);
    }
  }
  const sortedSpendingData = Object.entries(spendingData).sort(([, a], [, b]) => b.total - a.total);
  return sortedSpendingData;

}

function getStartAndEndDates(filter) {
  const today = new Date();
  let year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  let startDate, endDate;
  let month_number = 0  


  if ((filter.startsWith("20")) && (filter.length == 8))
    {
      month_number = parseInt(filter.substring(4, 6));
      year = parseInt(filter.substring(0, 4));
      startDate = new Date(year,month_number-1,1)
      endDate = new Date(year,month_number, 0);
      filter = "SpecificMonthYear"
    }

  if (filter) {
    if (filter.includes('M_') && filter) {
      month_number = parseInt(filter.replace('M_', ''));
      filter = 'M_'
    }
  }

  switch (filter) {
    case 'SpecificMonthYear': 
      break;
    case 'last30Days': // New case for 30 days
      endDate = new Date(year, month, day);
      startDate = new Date(year, month, day - 30); //Subtracts 30 days
      break;
    case 'lastMonth':
      endDate = new Date(year, month, day);
      startDate = new Date(year, month - 1, day);
      break;
    case 'last3Months':
      endDate = new Date(year, month, day);
      startDate = new Date(year, month - 3, day);
      break;
    case 'last6Months':
      endDate = new Date(year, month, day);
      startDate = new Date(year, month - 6, day);
      break;
    case 'ytd':
      endDate = new Date(year, month, day);
      startDate = new Date(year, 0, 1); // January 1st of the current year
      break;
    case 'last12Months':
      endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      startDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);
      break;
    case 'lastYear':
      endDate = new Date(year, month, day);
      startDate = new Date(year - 1, month, day);
      break;
    case 'last2Years':
      endDate = new Date(year, month, day);
      startDate = new Date(year - 2, month, day);
      break;
    case 'M_':
      if (month_number != 0) {
        endDate = new Date(year - 1, month_number, 0);
        startDate = new Date(year - 1, month_number-1, 1);
        break;
      }

    default:
      throw new Error('Invalid period specified.');
  }



  // Adjust start date if it falls outside the valid range
  if (startDate.getTime() < 0) {
    const diff = startDate.getTime() * -1; //Negative value
    startDate = new Date(0);
    startDate.setTime(diff)
  }

  return { startDate, endDate };
}


//CHECKING DATA

const dict_cschecking_transactions = csvToDict(fs.readFileSync('data/'+data_files.checking, {encoding:'utf8'}));
const sortedCheckingDataAsc = dict_cschecking_transactions.sort((a, b) => {
  return new Date(a.Date) - new Date(b.Date); //sort oldest to newest
});
sortedCheckingDataAsc.forEach(transaction => {
  checkingData.push({ x: transaction.Date, y: parseFloat(transaction.RunningBalance) });
});

let currentCheckingBalance = sortedCheckingDataAsc[sortedCheckingDataAsc.length-1].RunningBalance
console.log(currentCheckingBalance)


//SAVINGS DATA
const dict_pncsavings_transactions = csvToDict(fs.readFileSync('data/'+data_files.savings, {encoding:'utf8'}));

const sortedSavingsDataAsc = dict_pncsavings_transactions.sort((a, b) => {
  return new Date(a.Date) - new Date(b.Date); // Reversed comparison
});

sortedSavingsDataAsc.forEach(transaction => {
  savingsData.push({ x: transaction.Date, y: parseFloat(transaction.Balance) });
});

let currentSavingsBalance = sortedSavingsDataAsc[sortedSavingsDataAsc.length-1].Balance
console.log(currentSavingsBalance)

function formatCurrency(value){
    return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}


//SPENDING BY CATEGORY
function groupTransactionsByMonth(transactions) {
  const monthlyTotals = {}; // The dictionary to store totals by month

  for (const transaction of transactions) {
    const date = new Date(transaction.TransactionDate); // Assuming 'date' is a date string
    const month = date.toLocaleString('default', { month: 'long', year: 'numeric' });  // 'January 2024' etc.

    if (monthlyTotals[month]) {
      monthlyTotals[month] += parseFloat(transaction.Amount);  // add to existing total
    } else {
      monthlyTotals[month] = parseFloat(transaction.Amount);  // init new month
    }
  }
  return monthlyTotals;
}


function calculateAverageSpending(category,filter,spender) {
  const dates = getStartAndEndDates(filter);
  const startDate = new Date(dates.startDate);
  const endDate = new Date(dates.endDate);

  let months = parseInt(monthDiff(startDate,endDate));

  const filteredSpendingCategory = AccountData[spender].Transactions.filter(transaction => transaction.Category === category);
  const filteredSpending = filteredSpendingCategory.filter(transaction => {
    return new Date(transaction.TransactionDate) >= startDate && new Date(transaction.TransactionDate) <= endDate;
  });

  if (filteredSpending.length === 0) {
    return {averageSpending: 0, message: "No expenses found for this category in the last 12 months"}
  }
  const totalSpending = filteredSpending.reduce((sum, transaction) => sum + parseFloat(transaction.Amount)*-1, 0);
  const averageSpending = totalSpending / months;

  return {averageSpending: averageSpending.toFixed(2),totalSpending:totalSpending, category: category, message: "Success"};
}

app.get('/', (req, res) => {
  // Wait for data to be processed before rendering the page.  This is a simplified approach.  For production, consider promises or async/await.
  setTimeout(() => {
    res.render('index', {
      checkingData: JSON.stringify(checkingData),
      savingsData: JSON.stringify(savingsData),
      spendingData: JSON.stringify(spendingData),
      dateFilterDict: JSON.stringify(dateFilterDict), 
      spenderLabelData: JSON.stringify(spenderLabelData), 
    });
  }, 500); //Added a small delay to ensure data is processed.  Adjust as needed.
});

// API: Get all unique categories
app.get('/api/categories/:spender', (req, res) => {
  const spender = req.params.spender;
  res.json(Categories);
  //res.json(getUniqueCategories(spender));
});

app.get('/api/refreshDataFiles', (req, res) => {
  importData();
  // const spender = req.params.spender;
  // res.json(getUniqueCategories(spender));
});

// API: Get average spending by category
app.get('/api/average-spending/:category/:spender', (req, res) => {
  const category = req.params.category;
  const spender = req.params.spender;
  const averages = calculateAverageSpending(category,'lastYear',spender);
  res.json(averages);
});

// API: Get expenses by category
app.get('/api/expenses/:category/:spender', (req, res) => {
  const category = req.params.category;
  const spender = req.params.spender;
  
  dateFilterData= getStartAndEndDates('last12Months');
    const filteredSpendingCategory = AccountData[spender].Transactions.filter(transaction => transaction.Category === category);
  const filteredSpending = filteredSpendingCategory.filter(transaction => {
    return new Date(transaction.TransactionDate) >= dateFilterData.startDate && new Date(transaction.TransactionDate) <= dateFilterData.endDate;
  });
  const filteredSpendingbyMonth = groupTransactionsByMonth(filteredSpending)

  res.json(filteredSpendingbyMonth);
});


app.get('/api/datefilter', async (req, res) => {
  try {
    const { filter } = req.query;
    let dateFilterData = getStartAndEndDates(filter)

    dateFilterData.startDate = formatDate(dateFilterData.startDate)
    dateFilterData.endDate = formatDate(dateFilterData.endDate)

    res.json(dateFilterData);
  }
 catch (error) {
    console.error('Error fetching date filter:', error);
    res.status(500).json({ error: 'Failed to fetch date filter' });
  }
});

app.get('/api/kpis', async (req, res) => {
  const { filter } = req.query;
  //const { spender } = req.query;
  //console.log(spender)
  const { startDate, endDate } = getStartAndEndDates(filter)// { startDate:"11-01-2024",endDate:"11-30-2024" }
  try {
    // Input validation (crucial for security and robustness)
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    let months = parseInt(monthDiff(startDate,endDate));
    if (months == 0) { months = months+1 }
    const colorGreen = '#267326';
    const colorRed = '#c10b14';

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    if (isNaN(parsedStartDate) || isNaN(parsedEndDate)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.'});
    }
    
    //const filteredSpendings0 = spendersData[0].spending_transactions.filter(transaction => {
    const filteredSpendings0 = AccountData[0].Transactions.filter(transaction => {
      return new Date(transaction.TransactionDate) >= parsedStartDate && new Date(transaction.TransactionDate) <= parsedEndDate;
    });
    const filteredSpendings1 = AccountData[1].Transactions.filter(transaction => {
      return new Date(transaction.TransactionDate) >= parsedStartDate && new Date(transaction.TransactionDate) <= parsedEndDate;
    });

    //SPENDING KPIS
    spendingData = processSpendingCategoryData(filteredSpendings1)
    spendingData0 = processSpendingCategoryData(filteredSpendings0)


    let totalSpendingA = 0
    spendingData0.forEach(transaction => {
      totalSpendingA += transaction[1].total
    });

    let totalSpendingM = 0
    spendingData.forEach(transaction => {
      totalSpendingM += transaction[1].total
    });

    let spendingTargetM = targetData.spender1*months;
    let spendingDeltaM = totalSpendingM - spendingTargetM;
    let spendingDeltaLabelM = '';
    let spendingColorM = colorGreen
    if (spendingDeltaM <= 0) {
      spendingDeltaLabelM = 'Under Budget: '
    } else {
      spendingDeltaLabelM = 'Over Budget: '
      spendingColorM = colorRed
    }

    let spendingTargetA = targetData.spender2*months;
    let spendingDeltaA = totalSpendingA - spendingTargetA;
    let spendingDeltaLabelA = '';
    let spendingColorA = colorGreen
    if (parseFloat(spendingDeltaA) <= 0) {
      spendingDeltaLabelA = 'Under Budget: '
    } else {
      spendingDeltaLabelA = 'Over Budget: '
      spendingColorA = colorRed
    }

    let totalSpendingAllTarget = (targetData.spender2+targetData.spender1)*months
    let totalSpendingAllDelta = (parseFloat(totalSpendingA)+parseFloat(totalSpendingM)) - parseFloat(totalSpendingAllTarget)
    let totalSpendingAllDeltaLabel = '';
    let totalSpendingAllColor = colorGreen
    if (parseFloat(totalSpendingAllDelta) <= 0) {
      //good
      totalSpendingAllDeltaLabel = 'Under Budget: '
    } else {
      //bad
      totalSpendingAllDeltaLabel = 'Over Budget: '
      totalSpendingAllColor = colorRed
    }

    //CHECKING KPIS
    let checkingTarget = targetData.checking;
    let checkingDelta = currentCheckingBalance - checkingTarget;
    let checkingDeltaLabel = '';
    let checkingColor = colorGreen
    if (parseFloat(checkingDelta) >= 0) {
      //good
      checkingDeltaLabel = 'Over Target Min Balance: '
    } else {
      //bad
      checkingDeltaLabel = 'Under Target Min Balance: '
      checkingColor = colorRed
    }

    //SAVINGS KPIS
    const filteredSavings = dict_pncsavings_transactions.filter(transaction => {
      return new Date(transaction.Date) >= parsedStartDate && new Date(transaction.Date) <= parsedEndDate;
    });

    //console.log(filteredSavings)
    let totalSavings = 0
    filteredSavings.forEach(transaction => {
      totalSavings += parseFloat(transaction.Deposits)
    });

    //console.log(totalSavings)

    let savingsTarget = targetData.savings*months;
    let savingsDelta = totalSavings - savingsTarget;

    let savingsDeltaLabel = '';
    let savingsColor = colorGreen
    if (savingsDelta <= 0) {
      savingsDeltaLabel = 'Under Goal: '
      savingsColor = colorRed
    } else {
      savingsDeltaLabel = 'Over Goal: '
    }
    

    let kpis = [
      { name: spenderLabelData.spender1 + ' Spending', value: formatCurrency(totalSpendingM), target: formatCurrency(spendingTargetM), targetLabel:'Target', deltaLabel: spendingDeltaLabelM,delta: formatCurrency(spendingDeltaM),deltaLabelColor:spendingColorM },
      { name: spenderLabelData.spender0 + ' Spending', value: formatCurrency(totalSpendingA), target: formatCurrency(spendingTargetA), targetLabel:'Target', deltaLabel: spendingDeltaLabelA, delta: formatCurrency(spendingDeltaA), deltaLabelColor:spendingColorA},
      { name: 'All Spending', value: formatCurrency(totalSpendingA+totalSpendingM), target: formatCurrency(totalSpendingAllTarget), targetLabel:'Target', deltaLabel: totalSpendingAllDeltaLabel, delta: formatCurrency(totalSpendingAllDelta), deltaLabelColor:totalSpendingAllColor},
      { name: 'Checking Balance', value: formatCurrency(currentCheckingBalance), target: formatCurrency(3000), targetLabel:'Target Min Balance', deltaLabel: checkingDeltaLabel,delta: formatCurrency(checkingDelta),deltaLabelColor:checkingColor },
      { name: 'Savings', value: formatCurrency(totalSavings), target: formatCurrency(savingsTarget), targetLabel:'Target', deltaLabel: savingsDeltaLabel,delta:formatCurrency(savingsDelta),deltaLabelColor: savingsColor},
    ];


    res.json(kpis);

  } catch (error) {
    console.error('Error fetching spending:', error);
    res.status(500).json({ error: 'Failed to fetch spending' });
  }


});


app.get('/api/spending', async (req, res) => {
  const { filter } = req.query;
  const { spender } = req.query;
  //console.log(spender)

  const { startDate, endDate } = getStartAndEndDates(filter)// { startDate:"11-01-2024",endDate:"11-30-2024" }
  try {
    // Input validation (crucial for security and robustness)
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    if (isNaN(parsedStartDate) || isNaN(parsedEndDate)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.'});
    }

    const filteredSpendings = AccountData[spender].Transactions.filter(transaction => {
      return new Date(transaction.TransactionDate) >= parsedStartDate && new Date(transaction.TransactionDate) <= parsedEndDate;
    });
    spendingData = processSpendingCategoryData(filteredSpendings)

    let totalSpendingM = 0
    spendingData.forEach(transaction => {
      totalSpendingM += transaction[1].total
    });

    //console.log(totalSpendingM);
    // console.log(spendingData)
    res.json(spendingData);

  } catch (error) {
    console.error('Error fetching spending:', error);
    res.status(500).json({ error: 'Failed to fetch spending' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});


