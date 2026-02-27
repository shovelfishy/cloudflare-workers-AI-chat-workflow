-- DROP TABLE IF EXISTS Chatrooms;
CREATE TABLE IF NOT EXISTS Chatrooms (RoomId TEXT PRIMARY KEY, RoomName TEXT);
CREATE TABLE IF NOT EXISTS Users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS Sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES Users(id)
);
CREATE TABLE IF NOT EXISTS UsernameChanges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    old_username TEXT NOT NULL,
    new_username TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES Users(id)
);
-- INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (1, 'Alfreds Futterkiste', 'Maria Anders'), (4, 'Around the Horn', 'Thomas Hardy'), (11, 'Bs Beverages', 'Victoria Ashworth'), (13, 'Bs Beverages', 'Random Name');
