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
| data-table-paging-option-perPageSelect     | `[5, 10, 20, 50, ["{{ T "tablePerPageSelectAll" }}", -1]]`  | Paging option: Sets the per page options in the dropdown. |
| data-table-searchable | `true`  | Toggle the ability to search the dataset. |

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
