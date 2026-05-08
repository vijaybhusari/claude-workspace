from hello import hello

def test_hello():
    assert hello() == "Hello, World!"

if __name__ == "__main__":
    test_hello()
    print("All tests passed.")
