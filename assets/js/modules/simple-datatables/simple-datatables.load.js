// Adapted from https://github.com/fiduswriter/simple-datatables/blob/main/docs/demos/19-bootstrap-table/index.html


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
    },
    tableRender: (_data, table, _type) => {
        // ignore type ('main', 'print', 'header', 'message')
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
}    


// Track DataTable instances keyed by filter container ID.
// An array is used per ID because both the regular and responsive-wrapped
// table variants need to be filtered together.
const tableFilterInstances = {}

document.querySelectorAll('.data-table').forEach(tbl => {
    let sortable = (tbl.getAttribute('data-table-sortable') === 'true')
    tableOptions.sortable = sortable
    let paging = (tbl.getAttribute('data-table-paging') === 'true')
    tableOptions.paging = paging
    let searchable = (tbl.getAttribute('data-table-searchable') === 'true')
    tableOptions.searchable = searchable
    let perPage = parseInt(tbl.getAttribute('data-table-paging-option-perPage')) || 10
    tableOptions.perPage = perPage
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
    tableOptions.perPageSelect = perPageSelect;

    const dt = new window.simpleDatatables.DataTable(tbl, tableOptions)

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


