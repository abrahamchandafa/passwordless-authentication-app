const emailPattern = /^[a-zA-Z0-9._%+-]+@(cs|connect)\.hku\.hk$/;
let myInvalid = document.getElementById("my-invalid");
let myEmailBox = document.getElementById("my-email");
let myForm = document.getElementById("my-form");
let url = "http://localhost:8080/login";


let btn = document.getElementById("my-submit");
const submitHandler = function(event){
    event.preventDefault();
    let enteredEmail = document.getElementById("my-email").value;
    if(!emailPattern.test(enteredEmail)){ // invalid
        myInvalid.style.display = "block";
        myEmailBox.style.border = "solid red";     
    } else {
        myInvalid.style.display = "none";  
        myEmailBox.style.border = "solid black";

        // DO THE SENDING
        let headers = {
            "Content-type": "application/json", 
        }
        let body = JSON.stringify({
            method: "POST",
            email: enteredEmail
        });

        fetch(url, {
            method: "POST",
            headers: headers,
            body: body
        })
        .then(response => {
            console.log("SENT")
            if (!response.ok){
                throw new Error("network response not OK: "+response.statusText);
            }
              return response.text();
          }).then(html => {
              document.getElementById("my-response").innerHTML = html;
              document.getElementById("my-email").value = "";
         })
        .catch(err => {
            console.error("Error during fetch: ", err);
        });
    }

}
btn.addEventListener("click", submitHandler);
myForm.addEventListener("submit", (e) => {
    e.preventDefault();
})