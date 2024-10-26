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

    new window.simpleDatatables.DataTable(tbl, tableOptions)
})


