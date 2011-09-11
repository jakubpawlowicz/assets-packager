function factorial(n) {
  if (n == 0) {
    return 1;
  }
  return n * factorial(n - 1);
};

for (var i = 0, j = factorial(10).toString(), k = j.length; i < k; i++) {
  console.log(j[i]);
}