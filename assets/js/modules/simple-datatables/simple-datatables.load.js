// Adapted from https://github.com/fiduswriter/simple-datatables/blob/main/docs/demos/19-bootstrap-table/index.html


// Applies Bootstrap's header markup to simple-datatables' virtual DOM.
const styleHeader = (table) => {
    const thead = table.childNodes[0]
    thead.childNodes[0].childNodes.forEach(th => {
        if (!th.attributes) {
            th.attributes = {}
        }
        th.attributes.scope = "col"
        const innerHeader = th.childNodes[0]
        if (!innerHeader.attributes) {
            innerHeader.attributes = {}
        }
        let innerHeaderClass = innerHeader.attributes.class ? `${innerHeader.attributes.class} th-inner` : "th-inner"

        if (innerHeader.nodeName === "a") {
            innerHeaderClass += " sortable sortable-center both"
            if (th.attributes.class?.includes("desc")) {
                innerHeaderClass += " desc"
            } else if (th.attributes.class?.includes("asc")) {
                innerHeaderClass += " asc"
            }
        }
        innerHeader.attributes.class = innerHeaderClass
    })
    return table
}

// Mirrors Bootstrap's $grid-breakpoints. A wrapped table switches layout below the site's main
// breakpoint, following Bootstrap's `media-breakpoint-down` convention.
//
// Hinode concatenates every module's `.load.js` into one classic script, so all of them share a
// single top-level scope and a duplicate `const` would be a parse-time SyntaxError that takes down
// the whole bundle. Hence the module-specific name.
const dataTableBreakpoints = { xs: 0, sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400 }

// Moves the last column of every record onto a row of its own, so wide tables stay readable on
// small devices. This rewrites the virtual DOM only - never the row model - so sorting, searching
// and paging keep operating on the unmodified data, and the pager keeps counting records rather
// than rendered rows.
const wrapLastColumn = (table) => {
    const thead = table.childNodes[0]
    const tbody = table.childNodes[1]
    const headerRow = thead?.childNodes[0]
    if (!headerRow || headerRow.childNodes.length < 2 || !tbody) {
        return table
    }

    // Hides the heading of the wrapped column, rather than removing it. The library measures column
    // widths by walking the rendered `<th>` list in lockstep with its row model, so the header must
    // keep all of its cells. This mirrors Hinode's plain-table wrap, which hides the heading too.
    const lastHeader = headerRow.childNodes.length - 1
    headerRow.childNodes = headerRow.childNodes.map((th, index) => index !== lastHeader
        ? th
        : {
            ...th,
            attributes: {
                ...th.attributes,
                class: `${th.attributes?.class ?? ""} d-none`.trim()
            }
        })

    // Marks the table for the wrap-specific striping rules in Hinode's SCSS.
    table.attributes = {
        ...table.attributes,
        class: `${table.attributes?.class ?? ""} table-wrap`.trim()
    }

    tbody.childNodes = tbody.childNodes.flatMap(row => {
        const cells = row.childNodes
        if (!cells || cells.length < 2) {
            return [row]
        }
        const span = cells.length - 1
        const last = cells[span]

        return [
            {
                ...row,
                childNodes: cells.slice(0, span).map(cell => ({
                    ...cell,
                    attributes: {
                        ...cell.attributes,
                        class: `${cell.attributes?.class ?? ""} table-border-bottom-wrap`.trim()
                    }
                }))
            },
            {
                nodeName: "TR",
                // Carries the source row's attributes, so `data-index` survives on the synthesized
                // row and the library's row-selection handler keeps reporting the right record.
                attributes: { ...row.attributes },
                childNodes: [{
                    ...last,
                    attributes: { ...last.attributes, colspan: String(span) }
                }]
            }
        ]
    })

    return table
}

let tableOptions = {
    locale: "{{ site.Language.Lang | default "en" }}",
    labels: {
      placeholder: "{{ T "tablePlaceholder" }}",
      searchTitle: "{{ T "tablesSearchTitle" }}",
      perPage: "{{ T "tablesPerPage" }}",
      noRows: "{{ T "tablesNoRows" }}",
      noResults: "{{ T "tablesNoResults" }}",
      info: "{{ T "tablesInfo" }}"
    },
    classes: {
        active: "active",
        disabled: "disabled",
        selector: "form-select",
        paginationList: "pagination",
        paginationListItem: "page-item",
        paginationListItemLink: "page-link",
        input: "form-control search-input",
        search: "float-right search-data-table btn-group"
    }
}


// Track DataTable instances keyed by filter container ID. An array is used per ID so several
// tables can share one filter button group.
const tableFilterInstances = {}

document.querySelectorAll('.data-table').forEach(tbl => {
    let perPageSelectAttr = tbl.getAttribute('data-table-paging-option-perPageSelect');
    let perPageSelect;
    if (perPageSelectAttr) {
        try {
            perPageSelect = JSON.parse(perPageSelectAttr);
        } catch (e) {
            console.error('Error parsing perPageSelect, use default value:', e);
            perPageSelect = [5, 10, 20, 50, ["{{ T "tablePerPageSelectAll" }}", -1]];
        }
    } else {
        perPageSelect = [5, 10, 20, 50, ["{{ T "tablePerPageSelectAll" }}", -1]];
    }

    const options = {
        ...tableOptions,
        sortable: (tbl.getAttribute('data-table-sortable') === 'true'),
        paging: (tbl.getAttribute('data-table-paging') === 'true'),
        searchable: (tbl.getAttribute('data-table-searchable') === 'true'),
        perPage: parseInt(tbl.getAttribute('data-table-paging-option-perPage')) || 10,
        perPageSelect: perPageSelect
    }

    // A wrapped table renders its last column on a row of its own below the main breakpoint. At
    // `xs` the max-width evaluates below zero, so the query never matches and wrapping is off -
    // matching Hinode, which does not emit the attribute at `xs` either.
    let media = null
    if (tbl.getAttribute('data-table-wrap') === 'true') {
        const name = tbl.getAttribute('data-table-wrap-breakpoint') || 'md'
        const width = dataTableBreakpoints[name] ?? dataTableBreakpoints.md
        media = window.matchMedia(`(max-width: ${width - 0.02}px)`)
    }

    options.tableRender = (_data, table, type) => {
        const rendered = styleHeader(table)
        // 'header' is the sticky-header clone, 'message' the no-rows placeholder and 'print' the
        // print view - none of them wrap.
        if (type !== 'main' || !media?.matches) {
            return rendered
        }
        return wrapLastColumn(rendered)
    }

    const dt = new window.simpleDatatables.DataTable(tbl, options)

    // Redraw on the other side of the breakpoint. `update(true)` keeps the active sort, page and
    // search term; `refresh()` would clear the search.
    if (media) {
        media.addEventListener('change', () => dt.update(true))
    }

    // Register instance for category filter integration
    const filterId = tbl.getAttribute('data-filter-id')
    if (filterId) {
        const filterCol = parseInt(tbl.getAttribute('data-filter-col') ?? '1')
        if (!tableFilterInstances[filterId]) tableFilterInstances[filterId] = []
        tableFilterInstances[filterId].push({ dt, filterCol })
    }
})

// Category filter button group.
// Filtering runs through simple-datatables' search(term, columns, source), so it composes with
// sorting, pagination and the free-text search: the named source 'category-filter' is independent
// of the search input, so both narrow the result set at once. Hinode marks every filtered table as
// a data table, so an instance always exists by the time a button can be clicked.
document.querySelectorAll('[data-filter-table]').forEach(btn => {
    btn.addEventListener('click', function () {
        const tableId = this.getAttribute('data-filter-table')
        const filterValue = this.getAttribute('data-filter-value').toLowerCase()

        // Update active button state
        document.querySelectorAll(`[data-filter-table="${tableId}"]`).forEach(b => {
            b.classList.toggle('active', b === this)
        })

        const instances = tableFilterInstances[tableId]
        if (!instances) return

        instances.forEach(({ dt, filterCol }) => {
            dt.search(filterValue, [filterCol], 'category-filter')
        })
    })
})


