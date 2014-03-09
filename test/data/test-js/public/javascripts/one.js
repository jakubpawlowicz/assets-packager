function test() {
  var a = {
    b: 0,
    c: function() {}
  };
  a.b++;
  a.c();
  a.c();
};
