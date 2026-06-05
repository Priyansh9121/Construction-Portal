function FormInput({
    name,
    type = "text",
    placeholder,
    required = false,
  }) {
    return (
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
      />
    );
  }
  
  export default FormInput;