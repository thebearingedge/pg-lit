import pgLit, { PgLit } from '.'

describe('sql', () => {

  let sql: PgLit

  before(() => {
    sql = pgLit({
      connectionString: 'postgres://test:test@localhost/test'
    })
  })

  after(() => sql.pool.end())

  it('empty', async () => {
    await sql``
  })

  it('query', async () => {
    await sql`select 1 as "one"`
  })

  it('params', async () => {
    await sql`select ${1} as "one"`
  })

  it('nested', async () => {
    await sql`
      with "selected" as (
        ${sql`select 1 as "one"`}
      )
      select "one"
        from "selected"
    `
  })

  it('mixed', async () => {
    await sql`
      with "selected" as (
        ${sql`select 1 as "one"`}
      )
      select "one"
        from "selected"
       where "one" = ${1}
    `
  })

  it('scoped transaction', async () => {
    await sql.begin(async sql => {
      await sql`select 1 as "one"`
    })
  })

  it('nested transaction', async () => {
    await sql.begin(async sql => {
      await sql.begin(async sql => {
        await sql`select 1 as "one"`
      })
    })
  })

  it('returned transaction', async () => {
    const root = await sql.begin()
    const nested = await root.begin()
    await nested.rollback()
  })

  it('commit', async () => {
    const trx = await sql.begin()
    await trx.commit()
  })

  it('manual commit', async () => {
    await sql.begin(async trx => {
      await trx.commit()
    })
  })

  it('nested commit', async () => {
    await sql.begin(async sql => {
      await sql.begin(async sql => {
        await sql.commit()
      })
    })
  })

  it('rollback', async () => {
    const trx = await sql.begin()
    await trx.rollback()
  })

  it('manual rollback', async () => {
    await sql.begin(async sql => {
      await sql.rollback()
    })
  })

  it('nested rollback', async () => {
    await sql.begin(async sql => {
      await sql.begin(async sql => {
        await sql.rollback()
      })
    })
  })

  it('insert one', async () => {
    await sql.begin(async sql => {
      await sql`
        create temporary table "todos" (
          "todoId"      serial,
          "task"        text    not null,
          "isCompleted" boolean not null default false,
          primary key ("todoId")
        ) on commit drop
      `
      const todo = { task: 'do it' }
      await sql`insert into "todos" ${sql.insert(todo)}`
    })
  })

  it('insert many', async () => {
    await sql.begin(async sql => {
      await sql`
        create temporary table "todos" (
          "todoId"      serial,
          "task"        text    not null,
          "isCompleted" boolean not null default false,
          primary key ("todoId")
        ) on commit drop
      `
      const todos = [{ task: 'do it' }, { task: 'do it now' }]
      await sql`insert into "todos" ${sql.insert(todos)}`
    })
  })

  it('insert columns', async () => {
    await sql.begin(async sql => {
      await sql`
        create temporary table "todos" (
          "todoId"      serial,
          "task"        text    not null,
          "isCompleted" boolean not null default false,
          primary key ("todoId")
        ) on commit drop
      `
      const todos = [
        { task: 'do it', nope: true },
        { task: 'do it now', nope: true }
      ]
      await sql`insert into "todos" ${sql.insert(todos, 'task')}`
    })
  })

  it('insert one into', async () => {
    await sql.begin(async sql => {
      await sql`
        create temporary table "todos" (
          "todoId"      serial,
          "task"        text    not null,
          "isCompleted" boolean not null default false,
          primary key ("todoId")
        ) on commit drop
      `
      const todo = { task: 'do it' }
      await sql.insertInto('todos', todo)
    })
  })

  it('insert many into', async () => {
    await sql.begin(async sql => {
      await sql`
        create temporary table "todos" (
          "todoId"      serial,
          "task"        text    not null,
          "isCompleted" boolean not null default false,
          primary key ("todoId")
        ) on commit drop
      `
      const todos = [{ task: 'do it' }, { task: 'do it now' }]
      await sql.insertInto('todos', todos)
    })
  })

  it('insert columns into', async () => {
    await sql.begin(async sql => {
      await sql`
        create temporary table "todos" (
          "todoId"      serial,
          "task"        text    not null,
          "isCompleted" boolean not null default false,
          primary key ("todoId")
        ) on commit drop
      `
      const todos = [
        { task: 'do it', nope: true },
        { task: 'do it now', nope: true }
      ]
      await sql.insertInto('todos', todos, 'task')
    })
  })

})
