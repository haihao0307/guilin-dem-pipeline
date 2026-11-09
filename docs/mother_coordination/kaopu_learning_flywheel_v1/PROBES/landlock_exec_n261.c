#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/landlock.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>

static int ll_create(const struct landlock_ruleset_attr *attr, size_t size, __u32 flags) {
  return (int)syscall(SYS_landlock_create_ruleset, attr, size, flags);
}

static int ll_add(int ruleset_fd, enum landlock_rule_type type,
                  const void *attr, __u32 flags) {
  return (int)syscall(SYS_landlock_add_rule, ruleset_fd, type, attr, flags);
}

static int ll_restrict(int ruleset_fd, __u32 flags) {
  return (int)syscall(SYS_landlock_restrict_self, ruleset_fd, flags);
}

static void die(const char *message) {
  fprintf(stderr, "landlock_exec_n261: %s: %s\n", message, strerror(errno));
  exit(125);
}

int main(int argc, char **argv) {
  if (argc == 2 && strcmp(argv[1], "--abi") == 0) {
    int abi = ll_create(NULL, 0, LANDLOCK_CREATE_RULESET_VERSION);
    if (abi < 0) die("query ABI");
    printf("%d\n", abi);
    return 0;
  }

  int separator = -1;
  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--") == 0) {
      separator = i;
      break;
    }
  }
  if (separator < 2 || separator + 1 >= argc) {
    fprintf(stderr, "usage: %s ALLOW_PATH... -- COMMAND [ARG...]\n", argv[0]);
    return 2;
  }

  const __u64 handled = LANDLOCK_ACCESS_FS_EXECUTE |
                        LANDLOCK_ACCESS_FS_READ_FILE |
                        LANDLOCK_ACCESS_FS_READ_DIR;
  struct landlock_ruleset_attr ruleset = {.handled_access_fs = handled};
  int ruleset_fd = ll_create(&ruleset, sizeof(ruleset), 0);
  if (ruleset_fd < 0) die("create ruleset");

  for (int i = 1; i < separator; i++) {
    int parent_fd = open(argv[i], O_PATH | O_CLOEXEC);
    if (parent_fd < 0) die(argv[i]);
    struct landlock_path_beneath_attr rule = {
        .allowed_access = handled,
        .parent_fd = parent_fd,
    };
    if (ll_add(ruleset_fd, LANDLOCK_RULE_PATH_BENEATH, &rule, 0) < 0) {
      die("add path rule");
    }
    close(parent_fd);
  }

  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) < 0) die("no_new_privs");
  if (ll_restrict(ruleset_fd, 0) < 0) die("restrict self");
  close(ruleset_fd);

  execvp(argv[separator + 1], &argv[separator + 1]);
  die("exec command");
}
