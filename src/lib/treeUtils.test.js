import { describe, expect, it } from 'vitest'
import { computeVisibleList, getDepth, serializeAsciiTree } from './treeUtils'

function createFixtureDocument() {
  return {
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        name: 'main',
        parentId: null,
        childrenIds: ['develop', 'empty'],
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
      empty: {
        id: 'empty',
        name: '',
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

    expect(visible).toEqual(['root', 'develop', 'feat-a', 'empty'])
  })

  it('computes node depth from root', () => {
    const doc = createFixtureDocument()

    expect(getDepth(doc, 'root')).toBe(0)
    expect(getDepth(doc, 'develop')).toBe(1)
    expect(getDepth(doc, 'feat-a')).toBe(2)
  })

  it('serializes ASCII tree and renders empty node labels', () => {
    const doc = createFixtureDocument()
    const ascii = serializeAsciiTree(doc)

    expect(ascii).toBe(`main
├── develop
│   └── feat-a
└── (empty)`)
  })
})
