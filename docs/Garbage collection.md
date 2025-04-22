## Tracing GC

Traces which objects are live from a set of roots (local, global variables,
etc...) and garbage collects objects which are not referenced from one of the
root.

> [!note]
>
> At any point in time, the GC should be able to trace all values in the
> program. For example, even the parameter in `f([], g())` should be kept live
> during the call to `g()` which means it must explore the program stack where
> values (intermediaries) are stored.

### Semi-Space

This is an approach which relocates all live object to another space during GC.
Therefore, all dead objects will not relocated which compacts the heap.

##### A question about relocation

When an object is relocated, all subsequent values in the relocating part should
point to the newly relocated heap object. What is the optimal way to do this?
For example, tinylisp takes the opinionated approach of setting cons car to
UNBOUND and cons cdr to the new object in the old semi-space.

```c
if (car_(v) == UNBOUND)
    return cdr_(v);
```

femtolisp uses a similar trick, by tagging the object with `TAG_FWD` and then in
the relocating code:

```c
if (isforwarded(v)) return forwardloc(v);
```

It means that every allocated object should at least hold two values (one tagged
FWD and the newly relocated value). And this can be confirmed in the
`alloc_words` function:

```c
static value_t *alloc_words(int n) {
    // ...
    n = LLT_ALIGN(n, 2);   // only allocate multiples of 2 words
    // ...
    curheap += (n*sizeof(value_t));
    // ...
}
```

### Mark and sweep algorithm

Each object has a flag reserved for the GC.

1. Take all roots and explore the reference graph and mark each object as being
   '_in-use_'. This phase is called the **mark phase**.
2. In the **sweep phase**, explore all memory blocks and if they are not marked
   '_in-use_' then they can be freed.

> [!note]
>
> Some runtimes use a combinations of semi-space and free-list for generational
> garbage collection. Young generations are kept in a semi-space whereas older
> objects stay around in a free-list style heap.

### Precise garbage collection

The precise garbage collector will not keep live objects that are actually dead.
This can happen in the case of GC wich heuristically scan the stack for any
values looking like a pointer to the program heap.

### Load and Read barriers, safepoints

from the llvm gc docs:

1. A load barrier is a piece of code executed immediatly after the machine load
   instruction but before any use of the loaded value.
2. A store barrier is a piece of code which runs before any store.
3. A safepoint is a location known to have all values rooted (see note in
   [[Garbage collection#Tracing GC]]).

You can think of those barriers at a point where all values are markable (on the
stack) and not in some intermediary state as on the program registers. Reads
must go through an indirection if gc could have been triggered since the last
store. Otherwise, the value could have been moved and therefore we have a
use-after-free style error.
