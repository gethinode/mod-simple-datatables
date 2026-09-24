# Hinode Module - Simple Datatables

<!-- Tagline -->
<p align="center">
    <b>A Hugo module to enhance tables powered by simple-datatables to your Hinode site</b>
    <br />
</p>

<!-- Badges -->
<p align="center">
    <a href="https://gohugo.io" alt="Hugo website">
        <img src="https://img.shields.io/badge/generator-hugo-brightgreen">
    </a>
    <a href="https://gethinode.com" alt="Hinode theme">
        <img src="https://img.shields.io/badge/theme-hinode-blue">
    </a>
    <a href="https://github.com/gethinode/mod-simple-datatables/commits/main" alt="Last commit">
        <img src="https://img.shields.io/github/last-commit/gethinode/mod-simple-datatables.svg">
    </a>
    <a href="https://github.com/gethinode/mod-simple-datatables/issues" alt="Issues">
        <img src="https://img.shields.io/github/issues/gethinode/mod-simple-datatables.svg">
    </a>
    <a href="https://github.com/gethinode/mod-simple-datatables/pulls" alt="Pulls">
        <img src="https://img.shields.io/github/issues-pr-raw/gethinode/mod-simple-datatables.svg">
    </a>
    <a href="https://github.com/gethinode/mod-simple-datatables/blob/main/LICENSE" alt="License">
        <img src="https://img.shields.io/github/license/gethinode/mod-simple-datatables">
    </a>
</p>

## About

![Logo](https://raw.githubusercontent.com/gethinode/hinode/main/static/img/logo.png)

Hinode is a clean blog theme for [Hugo][hugo], an open-source static site generator. Hinode is available as a [template][repository_template], and a [main theme][repository]. This repository maintains a Hugo module to add [simple-datatables][simple-datatables] to a Hinode site. Visit the Hinode documentation site for [installation instructions][hinode_docs].

## Contributing

This module uses [semantic-release][semantic-release] to automate the release of new versions. The package uses `husky` and `commitlint` to ensure commit messages adhere to the [Conventional Commits][conventionalcommits] specification. You can run `npx git-cz` from the terminal to help prepare the commit message.

## Usage

Simple datatables is compatible with Bootstrap tables. It uses Hugo's `i18n` folder for the translation tables of [multilingual sites][hugo_multilingual]. Add the attribute `data-table` to the class of any table. The following arguments are supported:

| Argument              | Default | Description |
|-----------------------|---------|-------------|
| data-table-sortable   | `true`  | Toggle the ability to sort the columns. |
| data-table-paging     | `true`  | Whether paging is enabled for the table. |
| data-table-paging-option-perPage     | `10`  | Paging option: Sets the maximum number of rows to display on each page. Type: int  |
| data-table-paging-option-perPageSelect     | `[5, 10, 20, 50, ["{{ T "tablePerPageSelectAll" }}", -1]]`  | Paging option: Sets the per page options in the dropdown. i18 translation id for all: tablePerPageSelectAll |
| data-table-searchable | `true`  | Toggle the ability to search the dataset. |

### Initializing tables added later

The module initializes every `.data-table` present when its script runs. A script that adds tables afterwards, for example tables swapped in by htmx, can build them with the same labels, classes and rendering through `window.hinodeDatatables`:

| Member | Description |
|--------|-------------|
| `options(table)` | Returns the complete simple-datatables options for `table`, derived from its `data-table-*` attributes: the localized `labels` (the search label is visually hidden, the input's placeholder names it), the Bootstrap `classes`, `sortable`, `paging`, `searchable`, `perPage`, `perPageSelect`, and the `tableRender` hook that styles the header and wraps columns. Each call returns fresh objects, so you can add or override options such as `columns` before passing them on. |
| `attach(table, dataTable)` | Wires a constructed `DataTable` into the behavior that lives outside its options: a redraw when a wrapped table crosses its breakpoint, and the category filter button group. |

The module's own page-load pass uses the same two functions, so a table built through them is identical to one the module built itself.

To keep the page-load pass away from a table that your script builds itself, for example because it adds `columns` or event handlers of its own, mark the table with `data-table-init="manual"`. The pass skips any `.data-table` with that attribute and leaves it for your script to build through `options` and `attach`. Without the attribute, a table already in the page when the module script runs is built by the pass, even if your script meant to build it. Once built, a table cannot be rebuilt with different options.

The module script loads `async`, so it may run before or after your script. When `window.hinodeDatatables` is not set yet, wait for the `hinode:datatables-ready` event on `document`. Its `detail` holds the same API. The event fires after the page-load pass, so by then every table on the page that is not marked `manual` carries the `datatable-table` class:

```js
function withDatatables (callback) {
  if (window.hinodeDatatables) {
    callback(window.hinodeDatatables)
  } else {
    document.addEventListener('hinode:datatables-ready', event => callback(event.detail), { once: true })
  }
}

withDatatables(api => {
  document.querySelectorAll('.data-table:not(.datatable-table)').forEach(table => {
    const dataTable = new window.simpleDatatables.DataTable(table, api.options(table))
    api.attach(table, dataTable)
  })
})
```

<!-- MARKDOWN LINKS -->
[hugo]: https://gohugo.io
[hugo_multilingual]: https://gohugo.io/content-management/multilingual/
[hinode_docs]: https://gethinode.com
[simple-datatables]: https://github.com/fiduswriter/simple-datatables/tree/main
[repository]: https://github.com/gethinode/hinode.git
[repository_template]: https://github.com/gethinode/template.git
[conventionalcommits]: https://www.conventionalcommits.org
[husky]: https://typicode.github.io/husky/
[semantic-release]: https://semantic-release.gitbook.io/
