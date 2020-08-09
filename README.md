# pg-lit

A tagged template literal interface for `node-postgres`.

[![Build Status](https://travis-ci.com/thebearingedge/pg-lit.svg?branch=master)](https://travis-ci.com/thebearingedge/pg-lit.svg?branch=master)
[![Coverage Status](https://coveralls.io/repos/github/thebearingedge/pg-lit/badge.svg)](https://coveralls.io/github/thebearingedge/pg-lit)

## Installation

```shell
npm i pg pg-lit
```

## Instantiation

`pg-lit` takes any configuration that you'd normally pass to a [`pg.Pool`](https://node-postgres.com/api/pool) constructor and returns a template tag for querying the pool.

```js
const { pgLit } = require('pg-lit')
const sql = pgLit({ /* PoolConfig */ })
```

## Features

The `pg` library suits my use cases, but I found it somewhat unergonomic for a few common tasks. At present `pg-lit` comes with an intentionally small feature set at about ~250 SLoC, but I am open to suggestions.

Robust alternatives to `pg/pg-lit` include [`porsager/postgres`](https://github.com/porsager/postgres) and [`adelsz/pgtyped`](https://github.com/adelsz/pgtyped).

### Parameterized Queries

`pg-lit` uses the mechanism for parameterized queries provided by `node-postgres`. Queries created by `pg-lit` are formatted as "config" objects that are passed to the `node-postgres` driver.

```js
sql`select ${7} as "seven"`

/**
 * {
 *   text: 'select $1 as "seven"',
 *   values: [7]
 * }
 */
```

### Async/Thenable

Queries can be executed by `await` or `.then()` and are not computed or sent until that point in your code.

```js
try {
  const [gotem] = await sql`select ${7} as "seven"`
  // { seven: 7 }
} catch (err) {
  // deal with it
}

sql`select ${7} as "seven"`
  .then(([gotem]) => {
    // { seven: 7 }
  })
  .catch(err => {
    // deal with it
  })
```

### Fragments and Helpers

A few helpers are included that can be used for some common tasks that were less nice with the `pg` driver directly. Identifiers are escaped using the `pg` library. There are helpers for inserting and updating, and any of these can be embedded in a larger template.

```js
const patch = { isCompleted: true }

await sql`
  update "todos"
  ${sql.set(patch, 'isCompleted')}
   where "todoId" = ${7}
`

/**
 * {
 *   text: 'update "todos" set "isCompleted" = $1 where "todoId" = $2',
 *   values: [true, 7]
 * }
 */

await sql.insertInto('users', [
  { username: 'bebop' },
  { username: 'rocksteady' }
])

/**
 * {
 *   text: 'insert into "users" ("username") values ($1), ($2)',
 *   values: ['bebop', 'rocksteady']
 * }
 */
```

### Transactions

Transactions can be used with either automatic or manual `commit` and `rollback`.

```js
// automatic
try {
  await sql.begin(async sql => {
    await sql`
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

await trx.insertInto('users', [
  { username: 'bebop' },
  { username: 'rocksteady' }
])

await trx.commit() // or trx.rollback()
```

### Driver Access

You can still get at the `pg.Pool` instance once `pgLit` is instantiated.

```js
const sql = pgLit({ /* PoolConfig */ })

await sql.pool.end() // shut it down
```

## API
