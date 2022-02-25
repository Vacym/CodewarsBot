DROP ROUTINE if exists split(int, int, int, int);
DROP SEQUENCE if exists new_array_id;
DROP TABLE if exists arrays;
DROP TABLE if exists history;
DROP TABLE if exists settings;
DROP TABLE if exists katas;
DROP TABLE if exists users;

CREATE TABLE arrays (
    id integer NOT NULL,
    index integer NOT NULL,
    value VARCHAR(50)
);

CREATE FUNCTION split(
    id     integer,
    star   integer,
    en     integer,
    offfset integer)
RETURNS integer AS $$

DECLARE
    maxx int;
BEGIN

    SELECT INTO maxx MAX(arrays.index) from arrays WHERE arrays.id = split.id;

    DELETE FROM arrays WHERE arrays.id = split.id AND index BETWEEN star AND en-1;

    IF (offfset < 0) THEN

        FOR x IN en..maxx
        LOOP

            UPDATE arrays SET index = x + offfset WHERE arrays.id = split.id AND index = x;

        END LOOP;

        DELETE FROM arrays where arrays.id = split.id AND index > maxx + offfset;

    ELSIF (offfset > 0) THEN

        FOR x IN REVERSE en..maxx
        LOOP

            UPDATE arrays SET index = x + offfset WHERE arrays.id = split.id AND index = x;

        END LOOP;

    END IF;

    RETURN 1;

END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE new_array_id;

CREATE TABLE katas (
    id SERIAL PRIMARY KEY,
    cid CHAR(24) NOT NULL UNIQUE
);

CREATE TABLE history (
    kata_id INT UNIQUE,
    followers INT NOT NULL,

    hour BOOL  NOT NULL DEFAULT TRUE,
    day BOOL   NOT NULL DEFAULT TRUE,
    month BOOL NOT NULL DEFAULT TRUE,

    time            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed       INT NOT NULL DEFAULT 0,
    stars           INT NOT NULL DEFAULT 0,
    votes_very     INT NOT NULL DEFAULT 0,
    votes_somewhat INT NOT NULL DEFAULT 0,
    votes_not      INT NOT NULL DEFAULT 0,
    comments        INT NOT NULL DEFAULT 0,

    FOREIGN KEY (kata_id) REFERENCES katas(id)
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    tg_id INT NOT NULL UNIQUE
);

CREATE TABLE settings (
    user_id INT UNIQUE,
    katas INT,
    last_message date DEFAULT NOW(),

    hour BOOL    NOT NULL DEFAULT TRUE,
    day BOOL     NOT NULL DEFAULT TRUE,
    month BOOL   NOT NULL DEFAULT TRUE,

    mailing BOOL NOT NULL DEFAULT TRUE,

    FOREIGN KEY (user_id) REFERENCES users(id)
);