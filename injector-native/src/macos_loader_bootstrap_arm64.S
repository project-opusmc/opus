.text
.align 2

.globl _opus_remote_loader_bootstrap_start
_opus_remote_loader_bootstrap_start:
    // x0 is a RemoteCallContext pointer supplied by the transport helper.
    mov x19, x0

    // pthread_create_from_mach_thread(
    //   context.pthread_storage, nullptr, worker_entry, context)
    ldr x0, [x19, #56]
    mov x1, #0
    ldr x2, [x19, #48]
    mov x3, x19
    ldr x16, [x19, #40]
    blr x16

    // Publish pthread creation result before parking. The worker is a real
    // pthread and is the only thread that calls the selected remote function.
    str w0, [x19, #36]
    dmb ish

1:
    b 1b

.globl _opus_remote_loader_bootstrap_end
_opus_remote_loader_bootstrap_end:

.globl _opus_remote_loader_worker_start
_opus_remote_loader_worker_start:
    stp x19, x30, [sp, #-16]!
    mov x19, x0

    // context.function(context.argument0, context.argument1)
    ldr x16, [x19, #0]
    ldr x0, [x19, #8]
    ldr x1, [x19, #16]
    blr x16

    str x0, [x19, #24]
    mov w0, #1
    str w0, [x19, #32]
    dmb ish

    mov x0, #0
    ldp x19, x30, [sp], #16
    ret

.globl _opus_remote_loader_worker_end
_opus_remote_loader_worker_end:

// Gate 5 uses a separate, test-only bootstrap and worker. It never calls
// dlopen; the worker only changes the target-owned test marker and returns.
.globl _opus_native_execution_bootstrap_start
_opus_native_execution_bootstrap_start:
    // x0 is a NativeExecutionContext pointer supplied by the transport helper.
    mov x19, x0

    // pthread_create_from_mach_thread(
    //   context.pthread_storage, nullptr, worker_entry, context)
    ldr x0, [x19, #56]
    mov x1, #0
    ldr x2, [x19, #48]
    mov x3, x19
    ldr x16, [x19, #40]
    blr x16

    // Publish the creation result before parking the raw Mach thread. The
    // Gate 5 worker runs as a normal pthread and returns normally.
    str w0, [x19, #36]
    dmb ish

1:
    b 1b

.globl _opus_native_execution_bootstrap_end
_opus_native_execution_bootstrap_end:

.globl _opus_native_execution_worker_start
_opus_native_execution_worker_start:
    stp x19, x30, [sp, #-16]!
    mov x19, x0

    // Verify the known marker before changing it.
    ldr x0, [x19, #0]
    ldr w1, [x0]
    ldr w2, [x19, #8]
    cmp w1, w2
    b.ne 2f

    // Write the deterministic Gate 5 marker and publish success.
    ldr w3, [x19, #12]
    str w3, [x0]
    dmb ish
    mov w0, #1
    str w0, [x19, #16]
    dmb ish
    b 3f

2:
    mov w0, #2
    str w0, [x19, #16]
    dmb ish

3:
    mov x0, #0
    ldp x19, x30, [sp], #16
    ret

.globl _opus_native_execution_worker_end
_opus_native_execution_worker_end:
