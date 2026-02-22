import { describe, expect, it } from 'vitest'
import {
  buildAsciiRowsWithComments,
  computeVisibleList,
  computeVisibleRows,
  getDepth,
  migrateLegacyEmptyNodes,
  serializeAsciiTree,
  serializeMermaidGitGraph,
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

  it('serializes Mermaid gitGraph from tree structure', () => {
    const doc = createFixtureDocument()

    expect(serializeMermaidGitGraph(doc)).toBe(`gitGraph
  commit id:"main"
  checkout main
  branch develop
  checkout develop
  commit id:"develop"
  checkout develop
  branch feat-a
  checkout feat-a
  commit id:"feat-a"
  checkout main
  branch release
  checkout release
  commit id:"release"`)
  })

  it('serializes Mermaid gitGraph with unique sanitized branch names', () => {
    const doc = {
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          name: 'main',
          comment: '',
          parentId: null,
          childrenIds: ['a', 'b'],
        },
        a: {
          id: 'a',
          name: 'feat/a',
          comment: 'first',
          parentId: 'root',
          childrenIds: [],
        },
        b: {
          id: 'b',
          name: 'feat a',
          comment: 'second',
          parentId: 'root',
          childrenIds: [],
        },
      },
    }

    const mermaid = serializeMermaidGitGraph(doc)
    expect(mermaid).toContain('branch feat_a')
    expect(mermaid).toContain('branch feat_a_2')
    expect(mermaid).not.toContain('first')
    expect(mermaid).not.toContain('second')
  })

  it('branches from non-main root branch before creating children', () => {
    const doc = {
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          name: 'feat-box_mcp',
          comment: '',
          parentId: null,
          childrenIds: ['test'],
        },
        test: {
          id: 'test',
          name: 'test',
          comment: '',
          parentId: 'root',
          childrenIds: ['te'],
        },
        te: {
          id: 'te',
          name: 'te',
          comment: '',
          parentId: 'test',
          childrenIds: [],
        },
      },
    }

    expect(serializeMermaidGitGraph(doc)).toBe(`gitGraph
  commit id:"feat-box_mcp"
  branch feat-box_mcp
  checkout feat-box_mcp
  checkout feat-box_mcp
  branch test
  checkout test
  commit id:"test"
  checkout test
  branch te
  checkout te
  commit id:"te"`)
  })

  it('keeps explicit parent checkout when branching multiple siblings', () => {
    const doc = {
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          name: 'feat-box_mcp',
          comment: '',
          parentId: null,
          childrenIds: ['a', 'b'],
        },
        a: {
          id: 'a',
          name: 'alpha',
          comment: '',
          parentId: 'root',
          childrenIds: ['a1'],
        },
        a1: {
          id: 'a1',
          name: 'alpha-child',
          comment: '',
          parentId: 'a',
          childrenIds: [],
        },
        b: {
          id: 'b',
          name: 'beta',
          comment: '',
          parentId: 'root',
          childrenIds: [],
        },
      },
    }

    const mermaid = serializeMermaidGitGraph(doc)
    expect(mermaid).toContain('checkout feat-box_mcp\n  branch alpha')
    expect(mermaid).toContain('checkout alpha\n  branch alpha-child')
    expect(mermaid).toContain('checkout feat-box_mcp\n  branch beta')
  })
})
