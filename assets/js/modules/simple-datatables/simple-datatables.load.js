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
// Splits `total` columns into the group sizes the author asked for, or returns null when the
// request does not describe this table. A group list must be positive integers summing to the
// column count: anything else would silently drop or duplicate a column, so it is refused here
// and the caller falls back to the default split.
const parseColumnGroups = (spec, total) => {
    if (!spec) {
        return null
    }
    const groups = String(spec).split(",").map(part => Number.parseInt(part.trim(), 10))
    if (groups.some(n => !Number.isInteger(n) || n < 1)) {
        return null
    }
    if (groups.reduce((sum, n) => sum + n, 0) !== total) {
        return null
    }
    return groups
}

// Moves trailing columns of every record onto rows of their own, so wide tables stay readable on
// small devices. This rewrites the virtual DOM only - never the row model - so sorting, searching
// and paging keep operating on the unmodified data, and the pager keeps counting records rather
// than rendered rows.
//
// `groups` gives the column count per rendered row: [n-1, 1] is the original behaviour, where the
// last column drops to a row of its own. Only the first group keeps one cell per column, so it
// alone drives the column grid; every later group collapses into a single spanning cell. Letting a
// later group keep separate cells would make the browser reconcile several conflicting column
// counts within one table, and the widths stop meaning anything.
const wrapColumnGroups = (table, groups) => {
    const thead = table.childNodes[0]
    const tbody = table.childNodes[1]
    const headerRow = thead?.childNodes[0]
    if (!headerRow || headerRow.childNodes.length < 2 || !tbody) {
        return table
    }

    const total = headerRow.childNodes.length
    const split = groups ?? [total - 1, 1]
    const lead = split[0]

    // Hides the headings of every wrapped column, rather than removing them. The library measures
    // column widths by walking the rendered `<th>` list in lockstep with its row model, so the
    // header must keep all of its cells. This mirrors Hinode's plain-table wrap, which hides the
    // heading too.
    headerRow.childNodes = headerRow.childNodes.map((th, index) => index < lead
        ? th
        : {
            ...th,
            attributes: {
                ...th.attributes,
                class: `${th.attributes?.class ?? ""} d-none`.trim()
            }
        })

    // Marks the table for the wrap-specific striping rules in Hinode's SCSS. The row count per
    // record keys which rule applies, since the stripe repeats every two records. Only past the
    // default two, which the plain `table-wrap` selector already covers - matching what the
    // server-side wrap in render-table.html emits, so the two paths style identically.
    const countClass = split.length > 2 ? ` table-wrap-${split.length}` : ""
    table.attributes = {
        ...table.attributes,
        class: `${table.attributes?.class ?? ""} table-wrap${countClass}`.trim()
    }

    tbody.childNodes = tbody.childNodes.flatMap(row => {
        const cells = row.childNodes
        if (!cells || cells.length < 2) {
            return [row]
        }

        const rows = []
        let offset = 0
        split.forEach((size, groupIndex) => {
            const group = cells.slice(offset, offset + size)
            offset += size

            if (groupIndex === 0) {
                // The lead row keeps one cell per column and adds no colspan of its own. Its cell
                // count is what the table's column grid is built from - the folded headings are
                // display:none and contribute no column - so a folded row must span exactly this
                // many columns. Widening a lead cell here instead would declare more columns than
                // the grid holds, and the folded rows would stop short of the table's edge, leaving
                // their stripe and bottom border cut off part way across.
                rows.push({
                    ...row,
                    childNodes: group.map(cell => ({
                        ...cell,
                        attributes: {
                            ...cell.attributes,
                            class: `${cell.attributes?.class ?? ""} table-border-bottom-wrap`.trim()
                        }
                    }))
                })
                return
            }

            // A folded group becomes one spanning cell holding that group's values side by side.
            // The heading is hidden above, so the values carry no label - fine for self-describing
            // content such as badges, and the reason the group list is the author's to choose.
            const last = groupIndex === split.length - 1
            rows.push({
                nodeName: "TR",
                // Carries the source row's attributes, so `data-index` survives on the synthesized
                // row and the library's row-selection handler keeps reporting the right record.
                attributes: { ...row.attributes },
                childNodes: [{
                    nodeName: "TD",
                    attributes: {
                        colspan: String(lead),
                        class: `table-wrap-group-cell${last ? "" : " table-border-bottom-wrap"}`
                    },
                    // The layout goes on an inner element, never on the cell. A `display` of grid or
                    // flex takes a `td` out of the table formatting context, and `colspan` stops
                    // applying with it - the cell then covers one column instead of the row, so its
                    // stripe and border stop part way across the table.
                    childNodes: [{
                        nodeName: "DIV",
                        attributes: { class: "table-wrap-group" },
                        // Each source cell keeps its own wrapper rather than having its children
                        // merged into the group. Merging concatenates plain-text cells into one run
                        // ("DatabaselaunchShipped"), and no styling on the group separates them:
                        // adjacent text nodes collapse into a single anonymous box. A span per
                        // column gives one grid item per value whatever the cell holds.
                        // The source cell's own classes ride along: the markdown render hook puts
                        // the column's alignment there (`text-center`, `text-end`), and folding the
                        // column must not silently left-align a table the author aligned otherwise.
                        childNodes: group.map(cell => ({
                            nodeName: "SPAN",
                            attributes: {
                                class: `table-wrap-value ${cell.attributes?.class ?? ""}`.trim()
                            },
                            childNodes: cell.childNodes ?? []
                        }))
                    }]
                }]
            })
        })

        return rows
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

    const perPage = parseInt(tbl.getAttribute('data-table-paging-option-perPage')) || 10;

    // Keep the per-page control honest. When `perPage` is not one of the offered
    // options the select falls back to rendering its first entry while the table
    // pages at the requested size, so the control and the behaviour disagree with
    // nothing to signal it — the reader sees "5" above a page of 25 rows.
    // Inserting the value keeps the author's intent and makes the control show it.
    // Entries may be a bare number or a [label, value] pair (the "All" entry), so
    // compare against the value in either shape.
    const perPageValue = entry => (Array.isArray(entry) ? entry[1] : entry);
    if (!perPageSelect.some(entry => perPageValue(entry) === perPage)) {
        const numeric = perPageSelect.filter(entry => perPageValue(entry) > 0);
        const position = numeric.findIndex(entry => perPageValue(entry) > perPage);
        perPageSelect = perPageSelect.slice();
        perPageSelect.splice(position === -1 ? numeric.length : position, 0, perPage);
    }

    const options = {
        ...tableOptions,
        sortable: (tbl.getAttribute('data-table-sortable') === 'true'),
        paging: (tbl.getAttribute('data-table-paging') === 'true'),
        searchable: (tbl.getAttribute('data-table-searchable') === 'true'),
        perPage: perPage,
        perPageSelect: perPageSelect
    }

    // A wrapped table renders its last column on a row of its own below the main breakpoint. At
    // `xs` the max-width evaluates below zero, so the query never matches and wrapping is off -
    // matching Hinode, which does not emit the attribute at `xs` either.
    let media = null
    let wrapCols = null
    if (tbl.getAttribute('data-table-wrap') === 'true') {
        const name = tbl.getAttribute('data-table-wrap-breakpoint') || 'md'
        const width = dataTableBreakpoints[name] ?? dataTableBreakpoints.md
        media = window.matchMedia(`(max-width: ${width - 0.02}px)`)
        wrapCols = tbl.getAttribute('data-table-wrap-cols')
    }

    options.tableRender = (_data, table, type) => {
        const rendered = styleHeader(table)
        // 'header' is the sticky-header clone, 'message' the no-rows placeholder and 'print' the
        // print view - none of them wrap.
        if (type !== 'main' || !media?.matches) {
            return rendered
        }
        // Parsed per render rather than once: the column count comes from the rendered header, and
        // an invalid group list falls back to the default split rather than failing the table.
        const headerCells = rendered.childNodes[0]?.childNodes[0]?.childNodes?.length ?? 0
        return wrapColumnGroups(rendered, parseColumnGroups(wrapCols, headerCells))
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
// Uses simple-datatables search(term, columns, source) when a DataTable instance
// is available, so sorting, pagination and free-text search all continue to work
// alongside category filtering. Falls back to direct DOM row toggling when no
// DataTable is active on the table (e.g. filter-only without sortable/paginate/searchable).
document.querySelectorAll('[data-filter-table]').forEach(btn => {
    btn.addEventListener('click', function () {
        const tableId = this.getAttribute('data-filter-table')
        const filterValue = this.getAttribute('data-filter-value').toLowerCase()

        // Update active button state
        document.querySelectorAll(`[data-filter-table="${tableId}"]`).forEach(b => {
            b.classList.toggle('active', b === this)
        })

        const instances = tableFilterInstances[tableId]
        if (instances) {
            // DataTable path — filter persists across sorts and pagination updates.
            // The named source 'category-filter' is independent of the built-in
            // search input so both narrow the result set simultaneously.
            instances.forEach(({ dt, filterCol }) => {
                dt.search(filterValue, [filterCol], 'category-filter')
            })
        } else {
            // Fallback: direct DOM manipulation (no simple-datatables on this table)
            document.querySelectorAll(`[data-filter-container="${tableId}"]`).forEach(container => {
                const table = container.querySelector('table')
                if (!table) return
                const col = parseInt(table.getAttribute('data-filter-col') ?? '1')
                table.querySelectorAll('tbody tr').forEach(row => {
                    if (!filterValue) {
                        row.style.display = ''
                        return
                    }
                    const cell = row.cells[col]
                    const text = cell ? cell.textContent.trim().toLowerCase() : ''
                    row.style.display = text.includes(filterValue) ? '' : 'none'
                })
            })
        }
    })
})


