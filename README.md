# ura-posix

[ura](https://github.com/mohammedhrima/ura-lang) bindings to the C library and the operating system.

| package | what | use it with |
|---|---|---|
| io | files, printf, streams | `use "@/io"` |
| net | sockets | `use "@/net"` |
| stdlib | exit, rand, getenv, atoi | `use "@/stdlib"` |
| string | C string functions | `use "@/string"` |
| memory | malloc, calloc, free | `use "@/memory"` |
| time | time, clock, localtime, strftime | `use "@/time"` |
| unistd | process ids, fork, exec | `use "@/unistd"` |
| fcntl | open flags | `use "@/fcntl"` |
| dirent | reading folders | `use "@/dirent"` |
| stat | file status | `use "@/stat"` |
| signals | signal handlers | `use "@/signals"` |
| errno | error codes | `use "@/errno"` |
| ctype | character classes | `use "@/ctype"` |
| common | the few C functions most programs need (printf, calloc, write, exit...) | `use "@/common"` |
| header | all of the above in one `use` | `use "@/header"` |

## Install

```
ura install ura-posix 0.1.0 https://github.com/mohammedhrima/ura-posix
```

It adds this line to your project's `ura.conf`, and `ura install` also gets its own dependency, ura-math:

```ura
@dependency "ura-posix" "0.1.0" "https://github.com/mohammedhrima/ura-posix"
```
