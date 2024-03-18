window.addEventListener("load", function() {
	Array.prototype.filter.call(document.getElementsByClassName("modus-logo-spin"), function(i) {
		i.addEventListener("mouseenter", function() {
			i.classList.add("logo_spin"),
			setTimeout(function() {
				i.classList.remove("logo_spin");
			}, 800)
		}, !1);
	});
});


setTimeout(function(){
// Select all anchor tags on the page
const anchorTags = document.querySelectorAll("a");

if( anchorTags.length ){
	// Loop through each anchor tag
anchorTags.forEach((anchorTag) => {
  // Check if the anchor tag has no text content or href attribute
  if (!anchorTag.textContent.trim() && !anchorTag.getAttribute("href")) {
    // Add "#" as the href value
    anchorTag.setAttribute("href", "#");
  }
});
}
},100)


jQuery(".consult-platform").hover(function(){
	if( jQuery(window).width() >= 991 ) {
		jQuery('.fl-page-header-container.main').toggleClass("show-mega");
	}
});

jQuery(".consult-platform") .click( function(e){
	if( jQuery(window).width() < 991 ){
		if( e.detail == 1 ){
			e.preventDefault()
			jQuery('.fl-page-header-container.main').addClass("show-mega");
			setTimeout(() => {
				jQuery(this).parents('header').find('.mega-toggle-blocks-right').trigger('click');	
			}, 10);
			
		}
		if( e.detail == 2 ){
			window.location = e.target.href;
		}
	}
});
jQuery("ul#mega-menu-max_mega_menu_1").on("mmm:hideMobileMenu", function() {
	
	setTimeout(function(){
		if( ! jQuery('.mega-menu-toggle ').hasClass('mega-menu-open') ) {
			jQuery('.fl-page-header-container.main').removeClass("show-mega");
		}
	}, 12)
	
	
});