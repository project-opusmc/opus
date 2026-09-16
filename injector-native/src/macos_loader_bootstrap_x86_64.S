.text

.globl _opus_remote_loader_bootstrap_start
_opus_remote_loader_bootstrap_start:
    // rdi is a RemoteCallContext pointer supplied by the transport helper.
    movq %rdi, %rbx

    // pthread_create_from_mach_thread(
    //   context.pthread_storage, nullptr, worker_entry, context)
    movq 56(%rbx), %rdi
    xorq %rsi, %rsi
    movq 48(%rbx), %rdx
    movq %rbx, %rcx
    movq 40(%rbx), %rax
    callq *%rax

    // Publish pthread creation result before parking. The worker is a real
    // pthread and is the only thread that calls the selected remote function.
    movl %eax, 36(%rbx)
    mfence

1:
    jmp 1b

.globl _opus_remote_loader_bootstrap_end
_opus_remote_loader_bootstrap_end:

.globl _opus_remote_loader_worker_start
_opus_remote_loader_worker_start:
    pushq %rbx
    movq %rdi, %rbx

    // context.function(context.argument0, context.argument1)
    movq 0(%rbx), %rax
    movq 8(%rbx), %rdi
    movq 16(%rbx), %rsi
    callq *%rax

    movq %rax, 24(%rbx)
    movl $1, 32(%rbx)
    mfence

    xorq %rax, %rax
    popq %rbx
    retq

.globl _opus_remote_loader_worker_end
_opus_remote_loader_worker_end:
