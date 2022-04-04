DROP TABLE if exists subscription;
DROP TABLE if exists history;
DROP TABLE if exists settings;
DROP TABLE if exists katas;
DROP TABLE if exists users;

CREATE TABLE subscription (
    user_id integer NOT NULL,
    kata_id integer NOT NULL,
    UNIQUE(user_id, kata_id)
);

CREATE TABLE katas (
    id SERIAL PRIMARY KEY,
    cid CHAR(24) NOT NULL UNIQUE
);

CREATE TABLE history (
    kata_id INT UNIQUE,

    hour BOOL  NOT NULL DEFAULT TRUE,
    day BOOL   NOT NULL DEFAULT TRUE,
    month BOOL NOT NULL DEFAULT TRUE,

    time           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed      INT NOT NULL DEFAULT 0,
    stars          INT NOT NULL DEFAULT 0,
    votes_very     INT NOT NULL DEFAULT 0,
    votes_somewhat INT NOT NULL DEFAULT 0,
    votes_not      INT NOT NULL DEFAULT 0,
    comments       INT NOT NULL DEFAULT 0,

    FOREIGN KEY (kata_id) REFERENCES katas(id)
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    tg_id INT NOT NULL UNIQUE
);

CREATE TABLE settings (
    user_id INT UNIQUE,
    last_message date DEFAULT NOW(),

    hour  BOOL   NOT NULL DEFAULT TRUE,
    day   BOOL   NOT NULL DEFAULT TRUE,
    month BOOL   NOT NULL DEFAULT TRUE,

    mailing BOOL NOT NULL DEFAULT TRUE,

    FOREIGN KEY (user_id) REFERENCES users(id)
);