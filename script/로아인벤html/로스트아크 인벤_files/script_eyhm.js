$(document).ready(function() {
	new Swiper(".ibuilder-rolling-news", {
		direction: "vertical",
		loop: true,
		initialSlide: 0,
		slidesPerView: 'auto',
		spaceBetween: 10,
		autoplay: {
			delay: 5000,
		},
		navigation: {
			nextEl: '.swiper-button-down',
			prevEl: '.swiper-button-up',
		},
	});
});