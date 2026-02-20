import { describe, expect, it } from 'vitest'
import {
  buildAsciiRowsWithComments,
  computeVisibleList,
  computeVisibleRows,
  getDepth,
  migrateLegacyEmptyNodes,
  serializeAsciiTree,
} from './treeUtils'

function createFixtureDocument() {
  return {
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        name: 'main',
        comment: '',
        parentId: null,
        childrenIds: ['develop', 'release'],
      },
      develop: {
        id: 'develop',
        name: 'develop',
        comment: '',
        parentId: 'root',
        childrenIds: ['feat-a'],
      },
      'feat-a': {
        id: 'feat-a',
        name: 'feat-a',
        comment: '',
        parentId: 'develop',
        childrenIds: [],
      },
      release: {
        id: 'release',
        name: 'release',
        comment: '',
        parentId: 'root',
        childrenIds: [],
      },
    },
  }
}

describe('treeUtils', () => {
  it('computes preorder visible list', () => {
    const doc = createFixtureDocument()
    const visible = computeVisibleList(doc)

    expect(visible).toEqual(['root', 'develop', 'feat-a', 'release'])
  })

  it('computes node depth from root', () => {
    const doc = createFixtureDocument()

    expect(getDepth(doc, 'root')).toBe(0)
    expect(getDepth(doc, 'develop')).toBe(1)
    expect(getDepth(doc, 'feat-a')).toBe(2)
  })

  it('computes visible rows with ASCII metadata', () => {
    const doc = createFixtureDocument()
    const rows = computeVisibleRows(doc)

    expect(rows.map((row) => row.id)).toEqual(['root', 'develop', 'feat-a', 'release'])
    expect(rows[0].connector).toBe('')
    expect(rows[1].connector).toBe('├──')
    expect(rows[2].prefixGuides).toEqual([false, true])
    expect(rows[3].connector).toBe('└──')
  })

  it('serializes ASCII tree without empty placeholder label', () => {
    const doc = createFixtureDocument()
    const ascii = serializeAsciiTree(doc)

    expect(ascii).toBe(`main
├── develop
│   └── feat-a
└── release`)
  })

  it('migrates legacy empty nodes by promoting their children', () => {
    const doc = {
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          name: 'main',
          comment: '',
          parentId: null,
          childrenIds: ['empty-node'],
        },
        'empty-node': {
          id: 'empty-node',
          name: '',
          comment: '',
          parentId: 'root',
          childrenIds: ['feat-a'],
        },
        'feat-a': {
          id: 'feat-a',
          name: 'feat-a',
          comment: '',
          parentId: 'empty-node',
          childrenIds: [],
        },
      },
    }

    const migrated = migrateLegacyEmptyNodes(doc)

    expect(migrated.nodes['empty-node']).toBeUndefined()
    expect(migrated.nodes.root.childrenIds).toEqual(['feat-a'])
    expect(migrated.nodes['feat-a'].parentId).toBe('root')
  })

  it('builds aligned ASCII rows with comments', () => {
    const doc = {
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          name: 'main',
          comment: '',
          parentId: null,
          childrenIds: ['test', 'ok', 'subarasii'],
        },
        test: {
          id: 'test',
          name: 'test',
          comment: 'test',
          parentId: 'root',
          childrenIds: ['test2'],
        },
        test2: {
          id: 'test2',
          name: 'test2',
          comment: 'test2',
          parentId: 'test',
          childrenIds: [],
        },
        ok: {
          id: 'ok',
          name: 'ok',
          comment: 'ok',
          parentId: 'root',
          childrenIds: [],
        },
        subarasii: {
          id: 'subarasii',
          name: 'subarasii!',
          comment: 'subara',
          parentId: 'root',
          childrenIds: [],
        },
      },
    }

    const rows = buildAsciiRowsWithComments(doc)
    expect(rows.map((row) => row.id)).toEqual(['root', 'test', 'test2', 'ok', 'subarasii'])
    expect(rows[0].maxLeftLength).toBe(14)
    expect(rows[1].line).toBe('├── test          # test')
    expect(rows[2].line).toBe('│   └── test2     # test2')
    expect(rows[3].line).toBe('├── ok            # ok')
    expect(rows[4].line).toBe('└── subarasii!    # subara')
  })

  it('serializes ASCII tree with aligned comment columns', () => {
    const doc = {
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          name: 'main',
          comment: '',
          parentId: null,
          childrenIds: ['test', 'ok', 'subarasii'],
        },
        test: {
          id: 'test',
          name: 'test',
          comment: 'test',
          parentId: 'root',
          childrenIds: ['test2'],
        },
        test2: {
          id: 'test2',
          name: 'test2',
          comment: 'test2',
          parentId: 'test',
          childrenIds: [],
        },
        ok: {
          id: 'ok',
          name: 'ok',
          comment: 'ok',
          parentId: 'root',
          childrenIds: [],
        },
        subarasii: {
          id: 'subarasii',
          name: 'subarasii!',
          comment: 'subara',
          parentId: 'root',
          childrenIds: [],
        },
      },
    }

    expect(serializeAsciiTree(doc)).toBe(`main
├── test          # test
│   └── test2     # test2
├── ok            # ok
└── subarasii!    # subara`)
  })
})
