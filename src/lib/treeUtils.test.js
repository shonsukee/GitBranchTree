import { describe, expect, it } from 'vitest'
import { computeVisibleList, computeVisibleRows, getDepth, migrateLegacyEmptyNodes, serializeAsciiTree } from './treeUtils'

function createFixtureDocument() {
  return {
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        name: 'main',
        parentId: null,
        childrenIds: ['develop', 'release'],
      },
      develop: {
        id: 'develop',
        name: 'develop',
        parentId: 'root',
        childrenIds: ['feat-a'],
      },
      'feat-a': {
        id: 'feat-a',
        name: 'feat-a',
        parentId: 'develop',
        childrenIds: [],
      },
      release: {
        id: 'release',
        name: 'release',
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
          parentId: null,
          childrenIds: ['empty-node'],
        },
        'empty-node': {
          id: 'empty-node',
          name: '',
          parentId: 'root',
          childrenIds: ['feat-a'],
        },
        'feat-a': {
          id: 'feat-a',
          name: 'feat-a',
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
})
