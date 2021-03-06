# pg-lit

A tagged template literal interface for `node-postgres`.

[![Build Status](https://travis-ci.com/thebearingedge/pg-lit.svg?branch=master)](https://travis-ci.com/thebearingedge/pg-lit.svg?branch=master)
[![Coverage Status](https://coveralls.io/repos/github/thebearingedge/pg-lit/badge.svg)](https://coveralls.io/github/thebearingedge/pg-lit)

Also available: [Syntax Highlighting in VS Code](https://marketplace.visualstudio.com/items?itemName=thebearingedge.vscode-sql-lit)

## Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Features](#features)
  - [Parameterized Queries](#parameterized-queries)
  - [Async/Thenable](#asyncthenable)
  - [Fragments and Helpers](#fragments-and-helpers)
  - [Transactions](#transactions)
- [API](#api)

## Installation

```shell
npm i pg pg-lit
```

```shell
# for TypeScript
npm i -D @types/pg
```

## Getting Started

`pg-lit` takes any configuration that you'd normally pass to a [`pg.Pool`](https://node-postgres.com/api/pool) constructor and returns a template tag for querying the pool.

```js
import { pgLit } from 'pg-lit'
// or
const { pgLit } = require('pg-lit')

const sql = pgLit({ ...PoolConfig })
```

## Features

The `pg` library is solid, but I found it somewhat unergonomic for a few common tasks. `pg-lit` is a small wrapper that makes these tasks simpler while remaining "SQL-first".

Robust alternatives to `pg-lit` include [`porsager/postgres`](https://github.com/porsager/postgres) and [`adelsz/pgtyped`](https://github.com/adelsz/pgtyped).

### Parameterized Queries

`pg-lit` uses the parameterized queries mechanism provided by `node-postgres`. Queries created by `pg-lit` are formatted as "config" objects that are passed to the `node-postgres` driver.

```js
sql`select ${7} as "seven"`

{
  text: 'select $1 as "seven"',
  values: [7]
}
```

### Async/Thenable

A query can be executed by `await` or `.then()` but it is lazily computed, so it will not perform any I/O until your code does one of these.

```js
try {
  const [gotEm] = await sql`select ${7} as "seven"`
  // { seven: 7 }
} catch (err) {
  // deal with it
}

sql`select ${7} as "seven"`
  .then(([gotEm]) => {
    // { seven: 7 }
  })
  .catch(err => {
    // deal with it
  })
```

### Fragments and Helpers

A few helpers are included that can be used for some common tasks that were less nice with the `pg` driver directly. Identifiers are escaped using the `pg` library. There are helpers for inserting and updating, and any of these can be embedded in larger queries.

```js
const patch = { isCompleted: true }

await sql`
  update "todos"
  ${sql.set(patch, 'isCompleted')}
   where "todoId" = ${7}
`

{
  text: 'update "todos" set ("isCompleted") = row($1) where "todoId" = $2',
  values: [true, 7]
}

await sql.insertInto('users', [
  { username: 'bebop' },
  { username: 'rocksteady' }
])

{
  text: 'insert into "users" ("username") values ($1), ($2)',
  values: ['bebop', 'rocksteady']
}

```

### Transactions

Transactions can be used with either automatic or manual `commit` and `rollback`. "Nested" transactions are implemented using savepoints.

```js
// automatic
try {
  const [inserted] = sql.begin(async sql => {
    return sql`
      insert into "users"
      ${sql.insert({ username: 'krang' })}
      returning *
    `
  })
} catch (err) {
  // transaction rolled back
  // deal with it
}

// manual
const trx = await sql.begin()

try {
  await trx.insertInto('users', [
    { username: 'bebop' },
    { username: 'rocksteady' }
  ])
  await trx.commit()
} catch (err) {
  await trx.rollback()
}
```

### Driver Access

You can still get at the `pg.Pool` instance once `pgLit` is instantiated.

```js
const sql = pgLit({ /* PoolConfig */ })

await sql.pool.end() // shut it down
```

## API

### `pgLit(poolConfig) -> PgLit`

Instantiates a [`pg.Pool`](https://node-postgres.com/api/pool) and wraps it in a template tag interface.

```js
import { pgLit } from 'pg-lit'
const sql = pgLit({ ...PoolConfig })
```

### ``` PgLit`` -> SqlQuery```

Calling the `sql` tag with a template literal produces a query that can be either executed on its own, or embedded within another `SqlQuery`. Values passed into the template string are **not concatenated into the query text** (because security), but instead gathered to be sent as query parameters with `pg`.

```js
const simple = sql`select 1 as "one"`

const embedded = sql`
  with "selected" as (
    ${sql`select 1 as "one"`}
  )
  select "one"
    from "selected"
`
```

### `SqlQuery.then() -> Promise<SqlResult> OR await SqlQuery -> SqlResult`

A `SqlQuery` is a thenable object, so you can either call `.then()` on it, to instantiate a `Promise` for your result or `await` the result. A safe, parameterized query is sent through `pg` to the database.

```js
sql`select 1 as "one"`
  .then(result => {
    // got 'em
  })
  .catch(err => {
    // deal with it
  })

try {
  const result = await sql`select 1 as "one"`
  // got 'em
} catch (err) {
  // deal with it
}
```

### `SqlResult`

The `SqlResult` is actually an `Array` of rows returned by your query.

```js
const result = await sql`
  select *
    from "todos"
`

result.forEach(todo => {
  console.log(typeof todo) // 'object'
})
```

Usually the rows are what you're after, so for convenience that's what is returned, but properties of `pg`'s [`Result`](https://node-postgres.com/api/result) are added directly to the array of rows in case you need them.

- `SqlResult.oid`
- `SqlResult.fields`
- `SqlResult.command`
- `SqlResult.rowCount`

### `SqlQuery.exec({ name, rowMode }) -> Promise<SqlResult>`

Build and send the query to the database, optionally specifying a prepared statement `name` and a `rowMode`. These are options [supported directly by `pg`](https://node-postgres.com/features/queries#query-config-object).

### `PgLit.insertInto(table, rows, ...columns) -> SqlQuery`

Create a query that takes care of the annoying parts of constructing a basic `insert` statement. Like any `SqlQuery`, it can be embedded into the template of another `SqlQuery`.

- `table` the string name of the table to `insert into`.
- `rows` a single object or array of objects.
- `columns` are optional and by default will be inferred from the keys of first row being inserted.

```js
const users = [
  { username: 'bebop' },
  { username: 'rocksteady' }
]

await sql.insertInto('users', users, 'username')

{
  text: 'insert into "users" ("username") values ($1), ($2)',
  values: ['bebop', 'rocksteady']
}

const [bebop] = await sql`
  with "inserted" as (
    ${sql.insertInto('users', users)}
    returning *
  )
  select *
    from "inserted"
   where "username" = 'bebop'
`

{
  text: `
    with "inserted" as (
      insert into "users" ("username")
      values ($1), $(2)
      returning *
    )
    select *
      from "inserted"
     where "username" = 'bebop'
  `,
  values: ['bebop', 'rocksteady']
}
```

### `PgLit.set(updates, ...columns) -> SetClause`

Create a query fragment that takes care of the annoying parts of constructing the `set` clause of an `update` statement. **Note: this is not an executable `SqlQuery`**.

- `updates` is an object.
- `columns` are optional and by default will be inferred from the keys of the `updates` object.

```js
const updates = {
  isCompleted: false
  task: 'do it again'
}

await sql`
  update "todos"
  ${sql.set(updates, 'task', 'isCompleted')}
   where "todoId" = 1
`

{
  text: `
    update "todos"
       set ("task", "isCompleted") = row($1, $2)
     where "todoId" = 1
  `,
  values: ['do it again', false]
}
```

### `PgLit.insert(rows, ...columns) -> ColumnsAndValues`

Create a query fragment that takes care of the annoying parts of inserting records into a table while allowing an alias for the target table. **Note: this is not an executable `SqlQuery`**.

- `rows` can be an object or an array.
- `columns` are optional and by default will be inferred from the keys of the first row being inserted.

```js
const rows = [
  { username: 'bebop' },
  { username: 'rocksteady' }
]

const result = await sql`
  insert into "users"
  ${sql.insert(rows, 'username')}
  returning *
`

{
  text: 'insert into "users" ("username") values ($1), ($2)',
  values: ['bebop', 'rocksteady']
}
```

### `PgLit.begin(Trx -> any) -> Promise<any>`

A convenience method for executing a database transaction.

In this callback form, the transaction is managed for you by default. The return value of the callback is `await`ed and if this Promise is fulfilled, the transaction is committed. Otherwise, if this Promise is rejected, the transactions is rolled back.

The return value of the callback is also the Promise value returned by `.begin()` in this form.

```js
try {
  const [inserted] = sql.begin(async sql => {
    // in here, sql is scoped to a specific client connection
    // to be used for the lifetime of the transaction
    return sql`
      insert into "users"
      ${sql.insert({ username: 'krang' })}
      returning *
    `
  })
} catch (err) {
  // transaction rolled back
  // deal with it
}
```

### `PgLit.begin() -> Promise<Trx>`

In this form, you must manage the transaction yourself and ensure that either `commit` or `rollback` is called.

```js
const trx = await sql.begin()

try {
  await trx.insertInto('users', [
    { username: 'bebop' },
    { username: 'rocksteady' }
  ])
  await trx.commit()
} catch (err) {
  await trx.rollback()
}
```

### `Trx.commit() -> Promise<void>`

`commit` the transaction.

### `Trx.rollback() -> Promise<void>`

`rollback` the transaction.

### `Trx.savepoint() -> Promise<void>`

Create a uniquely identified `savepoint` for the transaction.

### `Trx.revert() -> Promise<void>`

`rollback to` the last `savepoint` of the transaction.

### `Trx.begin(Trx -> any) -> Promise<any>` OR `Trx.begin()`

Begin a "nested" transaction simulated with `savepoint` that is automatically saved again once the Promise is fulfilled or rolled back if the Promise is rejected. **Note: on rejection, the entire transaction is rolled back to its start, not just to the last `savepoint`**.

### ``` Trx`` -> Promise<SqlResult>```
### `Trx.insertInto(table, rows, ...columns)`
### `Trx.set(table, rows, ...columns)`
### `Trx.insert(rows, ...columns)`

The same methods available on a normal `PgLit` instance.
