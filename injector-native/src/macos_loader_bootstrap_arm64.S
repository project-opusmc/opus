.text
.align 2

.globl _opus_remote_loader_bootstrap_start
_opus_remote_loader_bootstrap_start:
    // x0 is a RemoteLoaderContext pointer supplied by the transport helper.
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
    // pthread and is the only thread that calls dlopen.
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

    // dlopen(context.runtime_path, context.dlopen_flags)
    ldr x16, [x19, #0]
    ldr x0, [x19, #8]
    ldr w1, [x19, #16]
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
