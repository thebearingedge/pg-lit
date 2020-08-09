import { expect } from 'chai'
import retry from 'promise-retry'
import { PgLit, Trx, pgLit } from '.'

describe('sql', () => {

  let sql: PgLit

  before(function (done) {
    this.timeout(10000)
    sql = pgLit({ connectionString: 'postgres://test:test@localhost/test' })
    retry(retry => sql.pool.query('select 1').then(() => {}, retry), {
      maxRetryTime: 10000
    }).then(done, done)
  })

  afterEach(() => {
    expect(sql.pool.idleCount).to.equal(sql.pool.totalCount, `
      not all pool clients have been released
    `)
  })

  after(() => sql.pool.end())

  it('empty', async () => {
    const [nothing] = await sql``
    expect(nothing).to.equal(undefined)
  })

  it('query', async () => {
    const [only] = await sql<{ one: number }>`select 1 as "one"`
    expect(only).to.deep.equal({ one: 1 })
  })

  it('params', async () => {
    const [only] = await sql`select ${1} as "one"`
    expect(only).to.deep.equal({ one: '1' })
  })

  it('nested', async () => {
    const [only] = await sql`
      with "selected" as (
        ${sql`select 1 as "one"`}
      )
      select "one"
        from "selected"
    `
    expect(only).to.deep.equal({ one: 1 })
  })

  it('mixed', async () => {
    const [only] = await sql`
      with "selected" as (
        ${sql`select 1 as "one"`}
      )
      select "one"
        from "selected"
       where "one" = ${1}
    `
    expect(only).to.deep.equal({ one: 1 })
  })

  it('scoped transaction', async () => {
    const [only] = await sql.begin(sql => {
      return sql`select 1 as "one"`
    })
    expect(only).to.deep.equal({ one: 1 })
  })

  it('nested transaction', async () => {
    const [only] = await sql.begin(sql => {
      return sql.begin(sql => {
        return sql`select 1 as "one"`
      })
    })
    expect(only).to.deep.equal({ one: 1 })
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

  it('savepoint', async () => {
    const trx = await sql.begin()
    await trx.savepoint()
    await trx.commit()
  })

  it('revert', async () => {
    const trx = await sql.begin()
    await trx.savepoint()
    await trx.revert()
    await trx.commit()
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

  it('automatic rollback', done => {
    (async () => {
      let trx: Trx
      try {
        await sql.begin(async sql => {
          trx = sql
          throw new Error('oops!')
        })
      } catch (err) {
        expect(trx!.getState()).to.equal('rolled back')
        expect(err)
          .to.be.an('error')
          .with.property('message', 'oops!')
        done()
      }
    })().catch(done)
  })

  it('nested automatic rollback', done => {
    (async () => {
      let trx: Trx
      try {
        await sql.begin(async sql => {
          await sql.begin(async sql => {
            trx = sql
            throw new Error('oops!')
          })
        })
      } catch (err) {
        expect(trx!.getState()).to.equal('rolled back')
        expect(err).to.have.property('message', 'oops!')
        done()
      }
    })().catch(done)
  })

  it('double commit', done => {
    (async () => {
      try {
        const trx = await sql.begin()
        await trx.commit()
        await trx.commit()
      } catch (err) {
        expect(err.message).to.equal(
          'transaction may not be committed after being committed'
        )
        done()
      }
    })().catch(done)
  })

  it('double rollback', done => {
    (async () => {
      try {
        const trx = await sql.begin()
        await trx.rollback()
        await trx.rollback()
      } catch (err) {
        expect(err.message).to.equal(
          'transaction may not be rolled back after being rolled back'
        )
        done()
      }
    })().catch(done)
  })

  it('save rolled back', done => {
    (async () => {
      try {
        const trx = await sql.begin()
        await trx.rollback()
        await trx.savepoint()
      } catch (err) {
        expect(err.message).to.equal(
          'transaction may not be saved after being rolled back'
        )
        done()
      }
    })().catch(done)
  })

  it('revert rolled back', done => {
    (async () => {
      try {
        const trx = await sql.begin()
        await trx.rollback()
        await trx.revert()
      } catch (err) {
        expect(err.message).to.equal(
          'transaction may not be reverted after being rolled back'
        )
        done()
      }
    })().catch(done)
  })

  it('insert one', async () => {
    await sql.begin(async sql => {
      await sql`
        create temporary table "todos" (
          "todoId"      serial,
          "task"        text    not null,
          "isCompleted" boolean not null default false
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
          "isCompleted" boolean not null default false
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
          "isCompleted" boolean not null default false
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
          "isCompleted" boolean not null default false
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
          "isCompleted" boolean not null default false
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
          "isCompleted" boolean not null default false
        ) on commit drop
      `
      const todos = [
        { task: 'do it', nope: true },
        { task: 'do it now', nope: true }
      ]
      await sql.insertInto('todos', todos, 'task')
    })
  })

  it('update set', async () => {
    await sql.begin(async sql => {
      await sql`
        create temporary table "todos" (
          "todoId"      serial,
          "task"        text    not null,
          "isCompleted" boolean not null default false
        ) on commit drop
      `
      const todo = { task: 'do it' }
      await sql`update "todos" ${sql.set(todo)}`
    })
  })

  it('update set columns', async () => {
    await sql.begin(async sql => {
      await sql`
        create temporary table "todos" (
          "todoId"      serial,
          "task"        text    not null,
          "isCompleted" boolean not null default false
        ) on commit drop
      `
      const todo = { task: 'do it' }
      await sql`update "todos" ${sql.set(todo, 'task')}`
    })
  })

})
